import {
  Transport,
  TransportSendOptions,
} from '@modelcontextprotocol/sdk/shared/transport.js'
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js'
import { v4 as uuidv4 } from 'uuid'
import { WebSocket, WebSocketServer } from 'ws'
import { Server } from 'http'

export class WebSocketServerTransport implements Transport {
  private wss!: WebSocketServer
  private clients: Map<string, WebSocket> = new Map()

  onclose?: () => void
  onerror?: (err: Error) => void
  private messageHandler?: (msg: JSONRPCMessage, clientId: string) => void
  onconnection?: (clientId: string) => void
  ondisconnection?: (clientId: string) => void

  set onmessage(
    handler: ((msg: JSONRPCMessage, clientId: string) => void) | undefined,
  ) {
    this.messageHandler = handler
  }

  constructor({ path, server }: { path: string; server: Server }) {
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

      ws.on('message', (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString())
          this.messageHandler?.(msg, clientId)
        } catch (err) {
          this.onerror?.(new Error(`Failed to parse message: ${err}`))
        }
      })

      ws.on('close', () => {
        this.clients.delete(clientId)
        this.ondisconnection?.(clientId)
      })

      ws.on('error', (err: Error) => {
        this.onerror?.(err)
      })
    })
  }

  async send(
    msg: JSONRPCMessage,
    options?: TransportSendOptions,
  ): Promise<void> {
    const clientId = options?.clientId
    const payload = JSON.stringify(msg)

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
      this.wss.close(() => {
        this.clients.clear()
        resolve()
      })
    })
  }
}