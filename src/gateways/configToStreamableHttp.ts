import express from 'express'
import cors, { type CorsOptions } from 'cors'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import {
  JSONRPCMessage,
  JSONRPCRequest,
  isInitializeRequest,
} from '@modelcontextprotocol/sdk/types.js'
import { Logger } from '../types.js'
import { getVersion } from '../lib/getVersion.js'
import { onSignals } from '../lib/onSignals.js'
import { serializeCorsOrigin } from '../lib/serializeCorsOrigin.js'
import { Config, loadConfig } from '../lib/config.js'
import { McpServerManager } from '../lib/mcpServerManager.js'
import { randomUUID } from 'node:crypto'
import { SessionAccessCounter } from '../lib/sessionAccessCounter.js'

export interface ConfigToStreamableHttpArgs {
  configPath: string
  port: number
  host: string
  streamableHttpPath: string
  logger: Logger
  corsOrigin: CorsOptions['origin']
  healthEndpoints: string[]
  headers: Record<string, string>
  stateless?: boolean
  sessionTimeout?: number | null
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

export async function configToStreamableHttp(args: ConfigToStreamableHttpArgs) {
  const {
    configPath,
    port,
    host,
    streamableHttpPath,
    logger,
    corsOrigin,
    healthEndpoints,
    headers,
    stateless = false,
    sessionTimeout,
  } = args

  logger.info(`  - config: ${configPath}`)
  logger.info(
    `  - Headers: ${Object.keys(headers).length ? JSON.stringify(headers) : '(none)'}`,
  )
  logger.info(`  - host: ${host}`)
  logger.info(`  - port: ${port}`)
  logger.info(`  - streamableHttpPath: ${streamableHttpPath}`)
  logger.info(`  - stateless: ${stateless}`)
  logger.info(
    `  - CORS: ${corsOrigin ? `enabled (${serializeCorsOrigin({ corsOrigin })})` : 'disabled'}`,
  )
  logger.info(
    `  - Health endpoints: ${healthEndpoints.length ? healthEndpoints.join(', ') : '(none)'}`,
  )

  if (!stateless && sessionTimeout) {
    logger.info(`  - Session timeout: ${sessionTimeout}ms`)
  }

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

  const app = express()
  app.use(express.json())

  if (corsOrigin) {
    app.use(
      cors({
        origin: corsOrigin,
        exposedHeaders: stateless ? [] : ['Mcp-Session-Id'],
      }),
    )
  }

  for (const ep of healthEndpoints) {
    app.get(ep, (_req, res) => {
      setResponseHeaders({
        res,
        headers,
      })
      res.send('ok')
    })
  }

  if (stateless) {
    // Stateless mode - create new transport for each request
    app.post(streamableHttpPath, async (req, res) => {
      logger.info('Received stateless StreamableHttp request')

      setResponseHeaders({
        res,
        headers,
      })

      try {
        const server = new Server(
          { name: 'mcp-superassistant-proxy', version: getVersion() },
          { capabilities: {} },
        )

        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
        })

        await server.connect(transport)

        transport.onmessage = async (msg: JSONRPCMessage) => {
          logger.info(`StreamableHttp → Servers: ${JSON.stringify(msg)}`)

          if ('method' in msg && 'id' in msg) {
            try {
              const response = await serverManager.handleRequest(
                msg as JSONRPCRequest,
              )
              logger.info('Servers → StreamableHttp:')
              logger.debug('Servers → StreamableHttp:', response)
              transport.send(response)
            } catch (err) {
              logger.error('Error handling request:', err)
              const errorResponse = {
                jsonrpc: '2.0' as const,
                id: (msg as JSONRPCRequest).id,
                error: {
                  code: -32000,
                  message: 'Internal error',
                },
              }
              transport.send(errorResponse)
            }
          }
        }

        transport.onclose = () => {
          logger.info('StreamableHttp connection closed')
        }

        transport.onerror = (err) => {
          logger.error('StreamableHttp error:', err)
        }

        await transport.handleRequest(req, res, req.body)
      } catch (error) {
        logger.error('Error handling MCP request:', error)
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Internal server error',
            },
            id: null,
          })
        }
      }
    })

    // Stateless mode doesn't support GET/DELETE
    app.get(streamableHttpPath, async (req, res) => {
      setResponseHeaders({ res, headers })
      res.status(405).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Method not allowed in stateless mode',
        },
        id: null,
      })
    })

    app.delete(streamableHttpPath, async (req, res) => {
      setResponseHeaders({ res, headers })
      res.status(405).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Method not allowed in stateless mode',
        },
        id: null,
      })
    })
  } else {
    // Stateful mode - maintain sessions
    const transports: { [sessionId: string]: StreamableHTTPServerTransport } =
      {}
    const sessionCounter = sessionTimeout
      ? new SessionAccessCounter(
          sessionTimeout,
          (sessionId: string) => {
            logger.info(`Session ${sessionId} timed out, cleaning up`)
            const transport = transports[sessionId]
            if (transport) {
              transport.close()
            }
            delete transports[sessionId]
          },
          logger,
        )
      : null

    app.post(streamableHttpPath, async (req, res) => {
      const sessionId = req.headers['mcp-session-id'] as string | undefined
      let transport: StreamableHTTPServerTransport

      setResponseHeaders({
        res,
        headers,
      })

      if (sessionId && transports[sessionId]) {
        // Reuse existing transport
        transport = transports[sessionId]
        sessionCounter?.inc(sessionId, 'POST request for existing session')
      } else if (!sessionId && isInitializeRequest(req.body)) {
        // New initialization request
        const server = new Server(
          { name: 'mcp-superassistant-proxy', version: getVersion() },
          { capabilities: {} },
        )

        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sessionId) => {
            transports[sessionId] = transport
            sessionCounter?.inc(sessionId, 'session initialization')
          },
        })
        await server.connect(transport)

        transport.onmessage = async (msg: JSONRPCMessage) => {
          logger.info(
            `StreamableHttp → Servers (session ${sessionId}): ${JSON.stringify(msg)}`,
          )

          if ('method' in msg && 'id' in msg) {
            try {
              const response = await serverManager.handleRequest(
                msg as JSONRPCRequest,
              )
              logger.info(`Servers → StreamableHttp (session ${sessionId}):`)
              logger.debug(
                `Servers → StreamableHttp (session ${sessionId}):`,
                response,
              )
              transport.send(response)
            } catch (err) {
              logger.error(
                `Error handling request in session ${sessionId}:`,
                err,
              )
              const errorResponse = {
                jsonrpc: '2.0' as const,
                id: (msg as JSONRPCRequest).id,
                error: {
                  code: -32000,
                  message: 'Internal error',
                },
              }
              transport.send(errorResponse)
            }
          }
        }

        transport.onclose = () => {
          logger.info(`StreamableHttp connection closed (session ${sessionId})`)
          if (transport.sessionId) {
            sessionCounter?.clear(
              transport.sessionId,
              false,
              'transport being closed',
            )
            delete transports[transport.sessionId]
          }
        }

        transport.onerror = (err) => {
          logger.error(`StreamableHttp error (session ${sessionId}):`, err)
          if (transport.sessionId) {
            sessionCounter?.clear(
              transport.sessionId,
              false,
              'transport emitting error',
            )
            delete transports[transport.sessionId]
          }
        }
      } else {
        // Invalid request
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: No valid session ID provided',
          },
          id: null,
        })
        return
      }

      // Decrement session access count when response ends
      let responseEnded = false
      const handleResponseEnd = (event: string) => {
        if (!responseEnded && transport.sessionId) {
          responseEnded = true
          logger.info(`Response ${event}`, transport.sessionId)
          sessionCounter?.dec(transport.sessionId, `POST response ${event}`)
        }
      }

      res.on('finish', () => handleResponseEnd('finished'))
      res.on('close', () => handleResponseEnd('closed'))

      await transport.handleRequest(req, res, req.body)
    })

    // Reusable handler for GET and DELETE requests in stateful mode
    const handleSessionRequest = async (
      req: express.Request,
      res: express.Response,
    ) => {
      const sessionId = req.headers['mcp-session-id'] as string | undefined

      setResponseHeaders({
        res,
        headers,
      })

      if (!sessionId || !transports[sessionId]) {
        res.status(400).send('Invalid or missing session ID')
        return
      }

      sessionCounter?.inc(
        sessionId,
        `${req.method} request for existing session`,
      )

      let responseEnded = false
      const handleResponseEnd = (event: string) => {
        if (!responseEnded) {
          responseEnded = true
          logger.info(`Response ${event}`, sessionId)
          sessionCounter?.dec(sessionId, `${req.method} response ${event}`)
        }
      }

      res.on('finish', () => handleResponseEnd('finished'))
      res.on('close', () => handleResponseEnd('closed'))

      const transport = transports[sessionId]
      await transport.handleRequest(req, res)
    }

    app.get(streamableHttpPath, handleSessionRequest)
    app.delete(streamableHttpPath, handleSessionRequest)
  }

  app.listen(port, host, () => {
    logger.info(`Listening on ${host}:${port}`)
    logger.info(
      `StreamableHttp endpoint: http://${host}:${port}${streamableHttpPath}`,
    )
    logger.info(`Mode: ${stateless ? 'stateless' : 'stateful'}`)
  })

  logger.info('Config-to-StreamableHttp gateway ready')
}
