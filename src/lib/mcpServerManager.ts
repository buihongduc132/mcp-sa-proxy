import { spawn, ChildProcessWithoutNullStreams } from 'child_process'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type {
  JSONRPCRequest,
  JSONRPCResponse,
  Tool,
  Resource,
  ListToolsResult,
  ListResourcesResult,
} from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { McpServerConfig, detectServerType } from './config.js'
import { getVersion } from './getVersion.js'
import { Logger } from '../types.js'

export interface ManagedServer {
  name: string
  config: McpServerConfig
  client: Client
  tools: Tool[]
  resources: Resource[]
  connected: boolean
  child?: ChildProcessWithoutNullStreams
}

export class McpServerManager {
  private servers: Map<string, ManagedServer> = new Map()
  private logger: Logger

  constructor(logger: Logger) {
    this.logger = logger
  }

  async addServer(name: string, config: McpServerConfig): Promise<void> {
    const serverType = detectServerType(config)
    const client = new Client(
      {
        name: 'mcp-superassistant-proxy',
        version: getVersion(),
      },
      {
        capabilities: {},
      },
    )

    let transport
    let child: ChildProcessWithoutNullStreams | undefined

    if (serverType === 'stdio') {
      if (!config.command) {
        throw new Error(`Stdio server ${name} missing command`)
      }

      const args = config.args || []

      this.logger.info(
        `Starting server ${name}: ${config.command} ${args.join(' ')}`,
      )
      this.logger.debug(
        `Command: "${config.command}", Args: [${args.map((a) => `"${a}"`).join(', ')}]`,
      )

      this.logger.debug(`Creating StdioClientTransport for ${name}`)

      try {
        // Use command and args to create the transport, similar to test files
        // StdioClientTransport will handle spawning the process internally
        transport = new StdioClientTransport({
          command: config.command,
          args: args,
          env: config.env ? { ...process.env, ...config.env } : process.env,
        } as any)
        this.logger.debug(`StdioClientTransport created for ${name}`)
      } catch (transportErr) {
        this.logger.error(
          `Failed to create StdioClientTransport for ${name}:`,
          transportErr,
        )
        throw transportErr
      }
    } else if (serverType === 'sse') {
      if (!config.url) {
        throw new Error(`HTTP server ${name} missing URL`)
      }

      const url = new URL(config.url)
      if (url.pathname.endsWith('/sse') || url.pathname.includes('/sse')) {
        const headers = config.headers || {}
        this.logger.info(
          `Connecting to SSE server ${name} with headers: ${Object.keys(headers).length ? JSON.stringify(headers) : '(none)'}`,
        )
        transport = new SSEClientTransport(url, {
          eventSourceInit: {
            fetch: (...props: Parameters<typeof fetch>) => {
              const [url, init = {}] = props
              return fetch(url, { 
                ...init, 
                headers: { ...init.headers, ...headers } 
              })
            },
          },
          requestInit: {
            headers,
          },
        })
      } else {
        throw new Error(
          `HTTP server ${name} URL must be an SSE endpoint (path should end with /sse)`,
        )
      }
    } else if (serverType === 'streamable-http') {
      if (!config.url) {
        throw new Error(`Streamable HTTP server ${name} missing URL`)
      }

      const headers = config.headers || {}
      this.logger.info(
        `Connecting to streamable HTTP server ${name}: ${config.url}`,
      )
      this.logger.info(
        `With headers: ${Object.keys(headers).length ? JSON.stringify(headers) : '(none)'}`,
      )
      const url = new URL(config.url)
      transport = new StreamableHTTPClientTransport(url, {
        requestInit: {
          headers,
        },
      })
    } else {
      throw new Error(`Unsupported server type: ${serverType}`)
    }

    try {
      this.logger.debug(`Attempting to connect client to transport for ${name}`)
      await client.connect(transport)
      this.logger.info(`Connected to server: ${name}`)

      const server: ManagedServer = {
        name,
        config,
        client,
        tools: [],
        resources: [],
        connected: true,
        child: child || undefined,
      }

      try {
        const toolsResponse = (await client.request(
          { method: 'tools/list', params: {} },
          z.object({ tools: z.array(z.any()) }),
        )) as ListToolsResult
        server.tools = toolsResponse.tools || []
        this.logger.info(`Server ${name} has ${server.tools.length} tools`)
      } catch (err) {
        this.logger.warn(`Server ${name} does not support tools: ${err}`)
      }

      try {
        const resourcesResponse = (await client.request(
          { method: 'resources/list', params: {} },
          z.object({ resources: z.array(z.any()) }),
        )) as ListResourcesResult
        server.resources = resourcesResponse.resources || []
        this.logger.info(
          `Server ${name} has ${server.resources.length} resources`,
        )
      } catch (err) {
        this.logger.debug(`Server ${name} does not support resources: ${err}`)
      }

      this.servers.set(name, server)
    } catch (err) {
      if (child) {
        child.kill()
      }
      throw new Error(`Failed to connect to server ${name}: ${err}`)
    }
  }

  async handleRequest(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    const { method, params, id } = request

    if (method === 'initialize') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
            resources: {},
          },
          serverInfo: {
            name: 'mcp-superassistant-proxy-unified',
            version: getVersion(),
          },
        },
      }
    }

    if (method === 'tools/list') {
      const allTools: Tool[] = []
      for (const [serverName, server] of this.servers) {
        if (server.connected) {
          for (const tool of server.tools) {
            allTools.push({
              ...tool,
              name: `${serverName}.${tool.name}`,
            })
          }
        }
      }
      return {
        jsonrpc: '2.0',
        id,
        result: { tools: allTools },
      }
    }

    if (method === 'resources/list') {
      const allResources: Resource[] = []
      for (const [serverName, server] of this.servers) {
        if (server.connected) {
          for (const resource of server.resources) {
            allResources.push({
              ...resource,
              name: `${serverName}.${resource.name}`,
              uri: `${serverName}://${resource.uri}`,
            })
          }
        }
      }
      return {
        jsonrpc: '2.0',
        id,
        result: { resources: allResources },
      }
    }

    if (method === 'tools/call') {
      const toolName = params?.name as string
      if (!toolName) {
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32602,
            message: 'Tool name is required',
          },
        } as any
      }

      let serverName: string
      let originalToolName: string

      if (toolName.includes('.')) {
        // Tool name includes server prefix
        ;[serverName, originalToolName] = toolName.split('.', 2)
      } else {
        // No server prefix, find which server has this tool
        let foundServer: string | null = null
        for (const [sName, server] of this.servers) {
          if (
            server.connected &&
            server.tools.some((tool) => tool.name === toolName)
          ) {
            if (foundServer) {
              // Tool exists in multiple servers, require explicit server name
              return {
                jsonrpc: '2.0',
                id,
                error: {
                  code: -32602,
                  message: `Tool '${toolName}' exists in multiple servers (${foundServer}, ${sName}). Use format: servername.toolname`,
                },
              } as any
            }
            foundServer = sName
          }
        }

        if (!foundServer) {
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32601,
              message: `Tool '${toolName}' not found in any connected server`,
            },
          } as any
        }

        serverName = foundServer
        originalToolName = toolName
      }

      const server = this.servers.get(serverName)

      if (!server || !server.connected) {
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Server ${serverName} not found or not connected`,
          },
        } as any
      }

      try {
        const response = await server.client.request(
          {
            method: 'tools/call',
            params: {
              ...params,
              name: originalToolName,
            },
          },
          z.any(),
        )
        return {
          jsonrpc: '2.0',
          id,
          result: response,
        }
      } catch (err: any) {
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: err.code || -32000,
            message: err.message || 'Tool call failed',
          },
        } as any
      }
    }

    if (method === 'resources/read') {
      const uri = params?.uri as string
      if (!uri || !uri.includes('://')) {
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32602,
            message:
              'Invalid resource URI. Expected format: servername://resource-uri',
          },
        } as any
      }

      const [serverName, originalUri] = uri.split('://', 2)
      const server = this.servers.get(serverName)

      if (!server || !server.connected) {
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Server ${serverName} not found or not connected`,
          },
        } as any
      }

      try {
        const response = await server.client.request(
          {
            method: 'resources/read',
            params: {
              ...params,
              uri: originalUri,
            },
          },
          z.any(),
        )
        return {
          jsonrpc: '2.0',
          id,
          result: response,
        }
      } catch (err: any) {
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: err.code || -32000,
            message: err.message || 'Resource read failed',
          },
        } as any
      }
    }

    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32601,
        message: `Method not found: ${method}`,
      },
    } as any
  }

  getServers(): Map<string, ManagedServer> {
    return this.servers
  }

  async cleanup(): Promise<void> {
    for (const [name, server] of this.servers) {
      try {
        if (server.child) {
          server.child.kill()
        }
        this.logger.info(`Cleaned up server: ${name}`)
      } catch (err) {
        this.logger.error(`Error cleaning up server ${name}: ${err}`)
      }
    }
    this.servers.clear()
  }
}
