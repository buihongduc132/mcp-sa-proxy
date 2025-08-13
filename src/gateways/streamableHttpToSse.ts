import express from 'express'
import bodyParser from 'body-parser'
import cors, { type CorsOptions } from 'cors'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import type {
  JSONRPCMessage,
  JSONRPCRequest,
  ClientCapabilities,
  Implementation,
} from '@modelcontextprotocol/sdk/types.js'
import { InitializeRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { getVersion } from '../lib/getVersion.js'
import { Logger } from '../types.js'
import { onSignals } from '../lib/onSignals.js'
import { serializeCorsOrigin } from '../lib/serializeCorsOrigin.js'

export interface StreamableHttpToSseArgs {
  streamableHttpUrl: string
  port: number
  host: string
  baseUrl: string
  ssePath: string
  messagePath: string
  logger: Logger
  corsOrigin: CorsOptions['origin']
  healthEndpoints: string[]
  headers: Record<string, string>
}

let streamableHttpClient: Client | undefined

const newInitializeStreamableHttpClient = ({
  message,
}: {
  message: JSONRPCRequest
}) => {
  const clientInfo = message.params?.clientInfo as Implementation | undefined
  const clientCapabilities = message.params?.capabilities as
    | ClientCapabilities
    | undefined

  return new Client(
    {
      name: clientInfo?.name ?? 'mcp-superassistant-proxy',
      version: clientInfo?.version ?? getVersion(),
    },
    {
      capabilities: clientCapabilities ?? {},
    },
  )
}

const newFallbackStreamableHttpClient = async ({
  streamableHttpTransport,
}: {
  streamableHttpTransport: StreamableHTTPClientTransport
}) => {
  const fallbackStreamableHttpClient = new Client(
    {
      name: 'mcp-superassistant-proxy',
      version: getVersion(),
    },
    {
      capabilities: {},
    },
  )

  await fallbackStreamableHttpClient.connect(streamableHttpTransport)
  return fallbackStreamableHttpClient
}

const setResponseHeaders = ({
  res,
  headers,
}: {
  res: express.Response
  headers: Record<string, string>
}) =>
  Object.entries(headers).forEach(([key, value]) => {
    res.setHeader(key, value)
  })

export async function streamableHttpToSse(args: StreamableHttpToSseArgs) {
  const {
    streamableHttpUrl,
    port,
    host,
    baseUrl,
    ssePath,
    messagePath,
    logger,
    corsOrigin,
    healthEndpoints,
    headers,
  } = args

  logger.info(`  - input StreamableHttp: ${streamableHttpUrl}`)
  logger.info(
    `  - Headers: ${Object.keys(headers).length ? JSON.stringify(headers) : '(none)'}`,
  )
  logger.info(`  - host: ${host}`)
  logger.info(`  - port: ${port}`)
  if (baseUrl) {
    logger.info(`  - baseUrl: ${baseUrl}`)
  }
  logger.info(`  - ssePath: ${ssePath}`)
  logger.info(`  - messagePath: ${messagePath}`)
  logger.info(
    `  - CORS: ${corsOrigin ? `enabled (${serializeCorsOrigin({ corsOrigin })})` : 'disabled'}`,
  )
  logger.info(
    `  - Health endpoints: ${healthEndpoints.length ? healthEndpoints.join(', ') : '(none)'}`,
  )

  onSignals({ logger })

  const inputStreamableHttpTransport = new StreamableHTTPClientTransport(
    new URL(streamableHttpUrl),
    {
      requestInit: {
        headers,
      },
    },
  )

  inputStreamableHttpTransport.onerror = (err) => {
    logger.error('Input StreamableHttp error:', err)
  }

  inputStreamableHttpTransport.onclose = () => {
    logger.error('Input StreamableHttp connection closed')
    process.exit(1)
  }

  const outputServer = new Server(
    { name: 'mcp-superassistant-proxy', version: getVersion() },
    { capabilities: {} },
  )

  const sessions: Record<
    string,
    { transport: SSEServerTransport; response: express.Response }
  > = {}

  const app = express()

  if (corsOrigin) {
    app.use(cors({ origin: corsOrigin }))
  }

  app.use((req, res, next) => {
    if (req.path === messagePath) return next()
    return bodyParser.json()(req, res, next)
  })

  for (const ep of healthEndpoints) {
    app.get(ep, (_req, res) => {
      setResponseHeaders({
        res,
        headers,
      })
      res.send('ok')
    })
  }

  app.get(ssePath, async (req, res) => {
    logger.info(`New SSE connection from ${req.ip}`)

    setResponseHeaders({
      res,
      headers,
    })

    const outputSseTransport = new SSEServerTransport(
      `${baseUrl}${messagePath}`,
      res,
    )
    await outputServer.connect(outputSseTransport)

    const sessionId = outputSseTransport.sessionId
    if (sessionId) {
      sessions[sessionId] = { transport: outputSseTransport, response: res }
    }

    const wrapResponse = (req: JSONRPCRequest, payload: object) => ({
      jsonrpc: req.jsonrpc || '2.0',
      id: req.id,
      ...payload,
    })

    outputSseTransport.onmessage = async (message: JSONRPCMessage) => {
      const isRequest = 'method' in message && 'id' in message
      if (isRequest) {
        logger.info(
          `Output SSE → Input StreamableHttp (session ${sessionId}):`,
          message,
        )
        const req = message as JSONRPCRequest
        let result

        try {
          if (!streamableHttpClient) {
            if (message.method === 'initialize') {
              streamableHttpClient = newInitializeStreamableHttpClient({
                message,
              })

              const originalRequest = streamableHttpClient.request

              streamableHttpClient.request = async function (
                requestMessage,
                ...restArgs
              ) {
                if (
                  InitializeRequestSchema.safeParse(requestMessage).success &&
                  message.params?.protocolVersion &&
                  requestMessage.params?.protocolVersion
                ) {
                  requestMessage.params.protocolVersion =
                    message.params.protocolVersion
                }

                result = await originalRequest.apply(this, [
                  requestMessage,
                  ...restArgs,
                ])

                return result
              }

              await streamableHttpClient.connect(inputStreamableHttpTransport)
              streamableHttpClient.request = originalRequest
            } else {
              logger.info(
                'StreamableHttp client not initialized, creating fallback client',
              )
              streamableHttpClient = await newFallbackStreamableHttpClient({
                streamableHttpTransport: inputStreamableHttpTransport,
              })
            }

            logger.info('Input StreamableHttp connected')
          } else {
            result = await streamableHttpClient.request(req, z.any())
          }
        } catch (err) {
          logger.error('Request error:', err)
          const errorCode =
            err && typeof err === 'object' && 'code' in err
              ? (err as any).code
              : -32000
          let errorMsg =
            err && typeof err === 'object' && 'message' in err
              ? (err as any).message
              : 'Internal error'
          const prefix = `MCP error ${errorCode}:`
          if (errorMsg.startsWith(prefix)) {
            errorMsg = errorMsg.slice(prefix.length).trim()
          }
          const errorResp = wrapResponse(req, {
            error: {
              code: errorCode,
              message: errorMsg,
            },
          })
          try {
            outputSseTransport.send(errorResp as any)
          } catch (sendErr) {
            logger.error(
              `Failed to send error response to session ${sessionId}:`,
              sendErr,
            )
            delete sessions[sessionId]
          }
          return
        }
        const response = wrapResponse(
          req,
          result.hasOwnProperty('error')
            ? { error: { ...result.error } }
            : { result: { ...result } },
        )
        logger.info(`Response (session ${sessionId}):`, response)
        try {
          outputSseTransport.send(response as any)
        } catch (sendErr) {
          logger.error(
            `Failed to send response to session ${sessionId}:`,
            sendErr,
          )
          delete sessions[sessionId]
        }
      } else {
        logger.info(
          `Input StreamableHttp → Output SSE (session ${sessionId}):`,
          message,
        )
        try {
          outputSseTransport.send(message)
        } catch (sendErr) {
          logger.error(
            `Failed to send message to session ${sessionId}:`,
            sendErr,
          )
          delete sessions[sessionId]
        }
      }
    }

    outputSseTransport.onclose = () => {
      logger.info(`Output SSE connection closed (session ${sessionId})`)
      delete sessions[sessionId]
    }

    outputSseTransport.onerror = (err) => {
      logger.error(`Output SSE error (session ${sessionId}):`, err)
      delete sessions[sessionId]
    }

    req.on('close', () => {
      logger.info(`Client disconnected (session ${sessionId})`)
      delete sessions[sessionId]
    })
  })

  app.post(messagePath, async (req: any, res: any) => {
    const sessionId = req.query.sessionId as string

    setResponseHeaders({
      res,
      headers,
    })

    if (!sessionId) {
      return res.status(400).send('Missing sessionId parameter')
    }

    const session = sessions[sessionId]
    if (session?.transport?.handlePostMessage) {
      logger.info(`POST to SSE transport (session ${sessionId})`)
      await session.transport.handlePostMessage(req, res)
    } else {
      res.status(503).send(`No active SSE connection for session ${sessionId}`)
    }
  })

  app.listen(port, host, () => {
    logger.info(`Listening on ${host}:${port}`)
    logger.info(`SSE endpoint: http://${host}:${port}${ssePath}`)
    logger.info(`POST messages: http://${host}:${port}${messagePath}`)
  })

  logger.info('StreamableHttp-to-SSE gateway ready')
}
