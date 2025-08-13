import express from 'express'
import bodyParser from 'body-parser'
import cors, { type CorsOptions } from 'cors'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import {
  JSONRPCMessage,
  JSONRPCRequest,
} from '@modelcontextprotocol/sdk/types.js'
import { Logger } from '../types.js'
import { getVersion } from '../lib/getVersion.js'
import { onSignals } from '../lib/onSignals.js'
import { serializeCorsOrigin } from '../lib/serializeCorsOrigin.js'
import { Config, loadConfig } from '../lib/config.js'
import { McpServerManager } from '../lib/mcpServerManager.js'

export interface ConfigToSseArgs {
  configPath: string
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

export async function configToSse(args: ConfigToSseArgs) {
  const {
    configPath,
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

  logger.info(`  - config: ${configPath}`)
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

  const serverManager = new McpServerManager(logger)

  const cleanup = async () => {
    await serverManager.cleanup()
  }

  onSignals({ logger, cleanup })

  let config: Config
  try {
    config = loadConfig(configPath)
    logger.info(
      `Loaded config with ${Object.keys(config.mcpServers).length} servers`,
    )
  } catch (err) {
    logger.error(`Failed to load config: ${err}`)
    process.exit(1)
  }

  for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
    try {
      await serverManager.addServer(serverName, serverConfig)
      logger.info(`Successfully initialized server: ${serverName}`)
    } catch (err) {
      logger.error(`Failed to initialize server ${serverName}: ${err}`)
      process.exit(1)
    }
  }

  const server = new Server(
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

    const sseTransport = new SSEServerTransport(`${baseUrl}${messagePath}`, res)
    await server.connect(sseTransport)

    const sessionId = sseTransport.sessionId
    if (sessionId) {
      sessions[sessionId] = { transport: sseTransport, response: res }
    }

    sseTransport.onmessage = async (msg: JSONRPCMessage) => {
      logger.info(
        `SSE → Servers (session ${sessionId}): ${JSON.stringify(msg)}`,
      )

      if ('method' in msg && 'id' in msg) {
        try {
          const response = await serverManager.handleRequest(
            msg as JSONRPCRequest,
          )
          logger.info(`Servers → SSE (session ${sessionId}):`)
          logger.debug(`Servers → SSE (session ${sessionId}):`, response)
          sseTransport.send(response)
        } catch (err) {
          logger.error(`Error handling request in session ${sessionId}:`, err)
          const errorResponse = {
            jsonrpc: '2.0' as const,
            id: (msg as JSONRPCRequest).id,
            error: {
              code: -32000,
              message: 'Internal error',
            },
          }
          sseTransport.send(errorResponse)
        }
      }
    }

    sseTransport.onclose = () => {
      logger.info(`SSE connection closed (session ${sessionId})`)
      delete sessions[sessionId]
    }

    sseTransport.onerror = (err) => {
      logger.error(`SSE error (session ${sessionId}):`, err)
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

  logger.info('Config-to-SSE gateway ready')
}
