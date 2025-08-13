import express from 'express'
import cors, { type CorsOptions } from 'cors'
import { createServer } from 'http'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import type {
  JSONRPCMessage,
  JSONRPCRequest,
  ClientCapabilities,
  Implementation,
} from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { getVersion } from '../lib/getVersion.js'
import { Logger } from '../types.js'
import { WebSocketServerTransport } from '../transports/websocket.js'
import { onSignals } from '../lib/onSignals.js'
import { serializeCorsOrigin } from '../lib/serializeCorsOrigin.js'

export interface SseToWsArgs {
  inputSseUrl: string
  port: number
  host: string
  messagePath: string
  logger: Logger
  corsOrigin: CorsOptions['origin']
  healthEndpoints: string[]
  headers: Record<string, string>
}

let sseClient: Client | undefined

const newInitializeSseClient = ({ message }: { message: JSONRPCRequest }) => {
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

const newFallbackSseClient = async ({
  sseTransport,
}: {
  sseTransport: SSEClientTransport
}) => {
  const fallbackSseClient = new Client(
    {
      name: 'mcp-superassistant-proxy',
      version: getVersion(),
    },
    {
      capabilities: {},
    },
  )

  await fallbackSseClient.connect(sseTransport)
  return fallbackSseClient
}

export async function sseToWs(args: SseToWsArgs) {
  const {
    inputSseUrl,
    port,
    host,
    messagePath,
    logger,
    corsOrigin,
    healthEndpoints,
    headers,
  } = args

  logger.info(`  - input SSE: ${inputSseUrl}`)
  logger.info(
    `  - Headers: ${Object.keys(headers).length ? JSON.stringify(headers) : '(none)'}`,
  )
  logger.info(`  - host: ${host}`)
  logger.info(`  - port: ${port}`)
  logger.info(`  - messagePath: ${messagePath}`)
  logger.info(
    `  - CORS: ${corsOrigin ? `enabled (${serializeCorsOrigin({ corsOrigin })})` : 'disabled'}`,
  )
  logger.info(
    `  - Health endpoints: ${healthEndpoints.length ? healthEndpoints.join(', ') : '(none)'}`,
  )

  let wsTransport: WebSocketServerTransport | null = null
  let isReady = false

  const cleanup = () => {
    if (wsTransport) {
      wsTransport.close().catch((err) => {
        logger.error(`Error stopping WebSocket server: ${err.message}`)
      })
    }
  }

  onSignals({
    logger,
    cleanup,
  })

  const inputSseTransport = new SSEClientTransport(new URL(inputSseUrl), {
    eventSourceInit: {
      fetch: (...props: Parameters<typeof fetch>) => {
        const [url, init = {}] = props
        return fetch(url, { ...init, headers: { ...init.headers, ...headers } })
      },
    },
    requestInit: {
      headers,
    },
  })

  inputSseTransport.onerror = (err) => {
    logger.error('Input SSE error:', err)
  }

  inputSseTransport.onclose = () => {
    logger.error('Input SSE connection closed')
    cleanup()
    process.exit(1)
  }

  try {
    const outputServer = new Server(
      { name: 'mcp-superassistant-proxy', version: getVersion() },
      { capabilities: {} },
    )

    const app = express()

    if (corsOrigin) {
      app.use(cors({ origin: corsOrigin }))
    }

    for (const ep of healthEndpoints) {
      app.get(ep, (_req, res) => {
        if (!isReady) {
          res.status(500).send('Server is not ready')
        } else {
          res.send('ok')
        }
      })
    }

    const httpServer = createServer(app)

    wsTransport = new WebSocketServerTransport({
      path: messagePath,
      server: httpServer,
    })

    await outputServer.connect(wsTransport)

    const wrapResponse = (req: JSONRPCRequest, payload: object) => ({
      jsonrpc: req.jsonrpc || '2.0',
      id: req.id,
      ...payload,
    })

    wsTransport.onmessage = async (message: JSONRPCMessage) => {
      // Extract client ID from the modified message ID
      const messageId = (message as any).id
      let clientId: string | undefined
      let originalId: string | number | undefined

      if (typeof messageId === 'string' && messageId.includes(':')) {
        const parts = messageId.split(':')
        clientId = parts[0]
        originalId = parts.slice(1).join(':')
        // Restore original ID for the request
        ;(message as any).id = isNaN(Number(originalId))
          ? originalId
          : Number(originalId)
      }

      const isRequest = 'method' in message && 'id' in message
      if (isRequest) {
        logger.info(`WebSocket → SSE (client ${clientId}):`, message)
        const req = message as JSONRPCRequest
        let result

        try {
          if (!sseClient) {
            if (message.method === 'initialize') {
              sseClient = newInitializeSseClient({
                message,
              })

              const originalRequest = sseClient.request

              sseClient.request = async function (requestMessage, ...restArgs) {
                if (
                  requestMessage.method === 'initialize' &&
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

              await sseClient.connect(inputSseTransport)
              sseClient.request = originalRequest
            } else {
              logger.info(
                'SSE client not initialized, creating fallback client',
              )
              sseClient = await newFallbackSseClient({
                sseTransport: inputSseTransport,
              })
            }

            logger.info('Input SSE connected')
          } else {
            result = await sseClient.request(req, z.any())
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
            await wsTransport!.send(errorResp as any, clientId)
          } catch (sendErr) {
            logger.error(
              `Failed to send error response to client ${clientId}:`,
              sendErr,
            )
          }
          return
        }
        const response = wrapResponse(
          req,
          result.hasOwnProperty('error')
            ? { error: { ...result.error } }
            : { result: { ...result } },
        )
        logger.info(`Response (client ${clientId}):`, response)
        try {
          await wsTransport!.send(response as any, clientId)
        } catch (sendErr) {
          logger.error(
            `Failed to send response to client ${clientId}:`,
            sendErr,
          )
        }
      } else {
        logger.info(`SSE → WebSocket (client ${clientId}):`, message)
        try {
          await wsTransport!.send(message, clientId)
        } catch (sendErr) {
          logger.error(`Failed to send message to client ${clientId}:`, sendErr)
        }
      }
    }

    wsTransport.onconnection = (clientId: string) => {
      logger.info(`New WebSocket connection: ${clientId}`)
    }

    wsTransport.ondisconnection = (clientId: string) => {
      logger.info(`WebSocket connection closed: ${clientId}`)
    }

    wsTransport.onerror = (err: Error) => {
      logger.error(`WebSocket error: ${err.message}`)
    }

    isReady = true

    httpServer.listen(port, host, () => {
      logger.info(`Listening on ${host}:${port}`)
      logger.info(`WebSocket endpoint: ws://${host}:${port}${messagePath}`)
    })

    logger.info('SSE-to-WebSocket gateway ready')
  } catch (err: any) {
    logger.error(`Failed to start: ${err.message}`)
    cleanup()
    process.exit(1)
  }
}
