import express from 'express'
import cors, { type CorsOptions } from 'cors'
import { createServer } from 'http'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
  JSONRPCMessage,
  JSONRPCRequest,
} from '@modelcontextprotocol/sdk/types.js'
import { Logger } from '../types.js'
import { getVersion } from '../lib/getVersion.js'
import { WebSocketServerTransport } from '../server/websocket.js'
import { onSignals } from '../lib/onSignals.js'
import { serializeCorsOrigin } from '../lib/serializeCorsOrigin.js'
import { Config, loadConfig } from '../lib/config.js'
import { McpServerManager } from '../lib/mcpServerManager.js'

export interface ConfigToWsArgs {
  configPath: string
  port: number
  host: string
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

export async function configToWs(args: ConfigToWsArgs) {
  const {
    configPath,
    port,
    host,
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
  logger.info(`  - messagePath: ${messagePath}`)
  logger.info(
    `  - CORS: ${corsOrigin ? `enabled (${serializeCorsOrigin({ corsOrigin })})` : 'disabled'}`,
  )
  logger.info(
    `  - Health endpoints: ${healthEndpoints.length ? healthEndpoints.join(', ') : '(none)'}`,
  )

  const serverManager = new McpServerManager(logger)
  let wsTransport: WebSocketServerTransport | null = null
  let isReady = false

  const cleanup = async () => {
    await serverManager.cleanup()
    if (wsTransport) {
      wsTransport.close().catch((err) => {
        logger.error(`Error stopping WebSocket server: ${err.message}`)
      })
    }
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

  try {
    const server = new Server(
      { name: 'mcp-superassistant-proxy', version: getVersion() },
      { capabilities: {} },
    )

    const app = express()

    if (corsOrigin) {
      app.use(cors({ origin: corsOrigin }))
    }

    for (const ep of healthEndpoints) {
      app.get(ep, (_req, res) => {
        setResponseHeaders({
          res,
          headers,
        })
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

    await server.connect(wsTransport)

    wsTransport.onmessage = async (message: JSONRPCMessage, clientId: string) => {
      const isRequest = 'method' in message && 'id' in message
      if (isRequest) {
        logger.info(`WebSocket → Servers (client ${clientId}):`, message)

        try {
          const response = await serverManager.handleRequest(
            message as JSONRPCRequest,
          )
          logger.info(`Servers → WebSocket (client ${clientId}):`)
          logger.debug(`Servers → WebSocket (client ${clientId}):`, response)

          await wsTransport!.send(response, { clientId })
        } catch (err) {
          logger.error(`Error handling request from client ${clientId}:`, err)
          const errorResponse = {
            jsonrpc: '2.0' as const,
            id: (message as JSONRPCRequest).id,
            error: {
              code: -32000,
              message: 'Internal error',
            },
          }
          try {
            await wsTransport!.send(errorResponse, { clientId })
          } catch (sendErr) {
            logger.error(
              `Failed to send error response to client ${clientId}:`,
              sendErr,
            )
          }
        }
      } else {
        logger.info(`Notification from client ${clientId}:`, message)
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

    logger.info('Config-to-WebSocket gateway ready')
  } catch (err: any) {
    logger.error(`Failed to start: ${err.message}`)
    cleanup()
    process.exit(1)
  }
}