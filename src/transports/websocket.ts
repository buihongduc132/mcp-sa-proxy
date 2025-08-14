import {
  Transport,
  TransportSendOptions,
} from '@modelcontextprotocol/sdk/shared/transport.js'
import {
  JSONRPCMessage,
  MessageExtraInfo,
  RequestId,
} from '@modelcontextprotocol/sdk/types.js'
import { v4 as uuidv4 } from 'uuid'
import { WebSocket, WebSocketServer } from 'ws'
import { Server } from 'http'

export interface WebSocketServerTransportOptions {
  path: string
  server: Server
  pingInterval?: number // Ping interval in milliseconds (default: 25000 = 25s)
  pongTimeout?: number  // Pong timeout in milliseconds (default: 5000 = 5s)
}

export class WebSocketServerTransport implements Transport {
  private wss!: WebSocketServer
  private clients: Map<string, WebSocket> = new Map()
  private requestClientMap: Map<RequestId, string> = new Map()
  private pingIntervals: Map<string, NodeJS.Timeout> = new Map()
  private pongTimeouts: Map<string, NodeJS.Timeout> = new Map()
  private readonly pingInterval: number
  private readonly pongTimeout: number

  onclose?: () => void
  onerror?: (err: Error) => void
  onmessage?: (message: JSONRPCMessage, extra?: MessageExtraInfo) => void
  onconnection?: (clientId: string) => void
  ondisconnection?: (clientId: string) => void

  constructor(options: WebSocketServerTransportOptions) {
    const { path, server, pingInterval = 25000, pongTimeout = 5000 } = options
    this.pingInterval = pingInterval
    this.pongTimeout = pongTimeout

    this.wss = new WebSocketServer({
      path,
      server,
    })
  }

  async start(): Promise<void> {
    this.wss.on('connection', (ws: WebSocket) => {
      const clientId = uuidv4()
      this.clients.set(clientId, ws)
      this.onconnection?.(clientId)

      // Start ping/pong keep-alive mechanism
      this.startKeepAlive(clientId, ws)

      ws.on('message', (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString()) as JSONRPCMessage
          if ('id' in msg && msg.id) {
            this.requestClientMap.set(msg.id, clientId)
          }
          this.onmessage?.(msg, { clientId } as any)
        } catch (err) {
          this.onerror?.(new Error(`Failed to parse message: ${err}`))
        }
      })

      ws.on('close', () => {
        this.cleanupClient(clientId)
      })

      ws.on('error', (err: Error) => {
        this.onerror?.(err)
        this.cleanupClient(clientId)
      })

      // Handle pong responses
      ws.on('pong', () => {
        // Clear the pong timeout since we received a pong
        const pongTimeout = this.pongTimeouts.get(clientId)
        if (pongTimeout) {
          clearTimeout(pongTimeout)
          this.pongTimeouts.delete(clientId)
        }
      })
    })
  }

  async send(
    msg: JSONRPCMessage,
    options?: TransportSendOptions,
  ): Promise<void> {
    const payload = JSON.stringify(msg)
    let clientId: string | undefined

    if (options?.relatedRequestId) {
      clientId = this.requestClientMap.get(options.relatedRequestId)
      if (clientId) {
        this.requestClientMap.delete(options.relatedRequestId)
      }
    }

    if (clientId) {
      const ws = this.clients.get(clientId)
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(payload)
      } else {
        this.clients.delete(clientId)
        this.ondisconnection?.(clientId)
      }
    } else {
      // broadcast to everyone
      for (const [id, ws] of this.clients) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(payload)
        } else {
          this.clients.delete(id)
          this.ondisconnection?.(id)
        }
      }
    }
  }

  async broadcast(msg: JSONRPCMessage): Promise<void> {
    return this.send(msg)
  }

  async close(): Promise<void> {
    return new Promise((resolve) => {
      // Clean up all clients and their timers
      for (const clientId of this.clients.keys()) {
        this.cleanupClient(clientId)
      }

      this.wss.close(() => {
        this.clients.clear()
        resolve()
      })
    })
  }

  private startKeepAlive(clientId: string, ws: WebSocket): void {
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        // Send ping and set up pong timeout
        ws.ping()

        const pongTimeout = setTimeout(() => {
          // No pong received within timeout, close connection
          ws.terminate()
          this.cleanupClient(clientId)
        }, this.pongTimeout)

        this.pongTimeouts.set(clientId, pongTimeout)
      } else {
        // Connection is not open, clean up
        this.cleanupClient(clientId)
      }
    }, this.pingInterval)

    this.pingIntervals.set(clientId, pingInterval)
  }

  private cleanupClient(clientId: string): void {
    // Clear ping interval
    const pingInterval = this.pingIntervals.get(clientId)
    if (pingInterval) {
      clearInterval(pingInterval)
      this.pingIntervals.delete(clientId)
    }

    // Clear pong timeout
    const pongTimeout = this.pongTimeouts.get(clientId)
    if (pongTimeout) {
      clearTimeout(pongTimeout)
      this.pongTimeouts.delete(clientId)
    }

    // Remove client
    this.clients.delete(clientId)
    this.ondisconnection?.(clientId)
  }
}