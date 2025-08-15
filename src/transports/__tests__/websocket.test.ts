import { WebSocketServerTransport } from '../websocket.js'
import { WebSocket, WebSocketServer } from 'ws'
import { Server } from 'http'
import { v4 as uuidv4 } from 'uuid'

jest.mock('ws', () => {
  const EventEmitter = require('events')
  
  class MockWebSocket extends EventEmitter {
    static OPEN = 1
    static CLOSED = 3
    
    readyState = MockWebSocket.OPEN
    
    send = jest.fn()
    close = jest.fn()
    terminate = jest.fn()
    ping = jest.fn()
  }
  
  class MockWebSocketServer extends EventEmitter {
    constructor() {
      super()
    }
    
    close = jest.fn((callback) => {
      callback()
    })
  }
  
  return {
    WebSocket: MockWebSocket,
    WebSocketServer: MockWebSocketServer,
  }
})

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-client-id'),
}))

describe('WebSocketServerTransport', () => {
  let transport: WebSocketServerTransport
  let mockServer: Server
  let mockWss: WebSocketServer
  let mockWs: WebSocket
  
  beforeEach(() => {
    jest.clearAllMocks()
    
    mockServer = {} as Server
    
    transport = new WebSocketServerTransport({
      path: '/ws',
      server: mockServer,
      pingInterval: 1000,
      pongTimeout: 500,
    })
    
    mockWss = (transport as any).wss
    mockWs = new WebSocket() as any
  })
  
  describe('start', () => {
    it('should set up connection handler', async () => {
      const onconnectionSpy = jest.fn()
      transport.onconnection = onconnectionSpy
      
      await transport.start()
      
      // Simulate a connection
      mockWss.emit('connection', mockWs)
      
      expect(onconnectionSpy).toHaveBeenCalledWith('mock-client-id')
      expect(transport.getConnectedClients().length).toBe(1)
    })
    
    it('should handle message events', async () => {
      const onmessageSpy = jest.fn()
      transport.onmessage = onmessageSpy
      
      await transport.start()
      
      // Simulate a connection
      mockWss.emit('connection', mockWs)
      
      // Simulate a message
      const message = { jsonrpc: '2.0', id: 1, method: 'test', params: {} }
      mockWs.emit('message', Buffer.from(JSON.stringify(message)))
      
      expect(onmessageSpy).toHaveBeenCalledWith(message, { clientId: 'mock-client-id' })
    })
    
    it('should capture client metadata from initialize request', async () => {
      await transport.start()
      
      // Simulate a connection
      mockWss.emit('connection', mockWs)
      
      // Simulate an initialize message
      const initializeMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          clientInfo: {
            name: 'test-client',
            version: '1.0.0',
          },
          capabilities: {
            tools: {},
          },
        },
      }
      
      mockWs.emit('message', Buffer.from(JSON.stringify(initializeMessage)))
      
      const metadata = transport.getAllClientMetadata().get('mock-client-id')
      expect(metadata).toBeDefined()
      expect(metadata.clientId).toBe('mock-client-id')
      expect(metadata.clientInfo.name).toBe('test-client')
      expect(metadata.clientInfo.version).toBe('1.0.0')
      expect(metadata.protocolVersion).toBe('2024-11-05')
    })
    
    it('should handle message parsing errors', async () => {
      const onerrorSpy = jest.fn()
      transport.onerror = onerrorSpy
      
      await transport.start()
      
      // Simulate a connection
      mockWss.emit('connection', mockWs)
      
      // Simulate an invalid message
      mockWs.emit('message', Buffer.from('invalid json'))
      
      expect(onerrorSpy).toHaveBeenCalled()
      expect(onerrorSpy.mock.calls[0][0].message).toContain('Failed to parse message')
    })
    
    it('should handle close events', async () => {
      const ondisconnectionSpy = jest.fn()
      transport.ondisconnection = ondisconnectionSpy
      
      await transport.start()
      
      // Simulate a connection
      mockWss.emit('connection', mockWs)
      
      // Simulate a close event
      mockWs.emit('close')
      
      expect(ondisconnectionSpy).toHaveBeenCalledWith('mock-client-id')
      expect(transport.getConnectedClients().length).toBe(0)
    })
    
    it('should handle error events', async () => {
      const onerrorSpy = jest.fn()
      const ondisconnectionSpy = jest.fn()
      transport.onerror = onerrorSpy
      transport.ondisconnection = ondisconnectionSpy
      
      await transport.start()
      
      // Simulate a connection
      mockWss.emit('connection', mockWs)
      
      // Simulate an error event
      const error = new Error('WebSocket error')
      mockWs.emit('error', error)
      
      expect(onerrorSpy).toHaveBeenCalledWith(error)
      expect(ondisconnectionSpy).toHaveBeenCalledWith('mock-client-id')
      expect(transport.getConnectedClients().length).toBe(0)
    })
    
    it('should handle pong events', async () => {
      jest.useFakeTimers()
      
      await transport.start()
      
      // Simulate a connection
      mockWss.emit('connection', mockWs)
      
      // Simulate a ping (which sets up a pong timeout)
      jest.advanceTimersByTime(1000)
      expect(mockWs.ping).toHaveBeenCalled()
      
      // Simulate a pong response
      mockWs.emit('pong')
      
      // The client should still be connected after the pong timeout
      jest.advanceTimersByTime(500)
      expect(transport.getConnectedClients().length).toBe(1)
      expect(mockWs.terminate).not.toHaveBeenCalled()
      
      jest.useRealTimers()
    })
    
    it('should terminate connection if no pong is received', async () => {
      jest.useFakeTimers()
      
      await transport.start()
      
      // Simulate a connection
      mockWss.emit('connection', mockWs)
      
      // Simulate a ping (which sets up a pong timeout)
      jest.advanceTimersByTime(1000)
      expect(mockWs.ping).toHaveBeenCalled()
      
      // No pong response, should terminate after pong timeout
      jest.advanceTimersByTime(500)
      expect(mockWs.terminate).toHaveBeenCalled()
      expect(transport.getConnectedClients().length).toBe(0)
      
      jest.useRealTimers()
    })
  })
  
  describe('send', () => {
    beforeEach(async () => {
      await transport.start()
      mockWss.emit('connection', mockWs)
    })
    
    it('should send message to specific client', async () => {
      // First, simulate a request from the client to establish the mapping
      const requestMessage = { jsonrpc: '2.0', id: 'req-1', method: 'test', params: {} }
      mockWs.emit('message', Buffer.from(JSON.stringify(requestMessage)))
      
      // Now send a response
      const responseMessage = { jsonrpc: '2.0', id: 'resp-1', result: {} }
      await transport.send(responseMessage, { relatedRequestId: 'req-1' })
      
      expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify(responseMessage))
    })
    
    it('should broadcast message when no client is specified', async () => {
      const message = { jsonrpc: '2.0', id: 'broadcast', method: 'notification', params: {} }
      await transport.send(message)
      
      expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify(message))
    })
    
    it('should handle closed connections during send', async () => {
      const ondisconnectionSpy = jest.fn()
      transport.ondisconnection = ondisconnectionSpy
      
      // Set the connection to closed
      mockWs.readyState = WebSocket.CLOSED
      
      const message = { jsonrpc: '2.0', id: 'broadcast', method: 'notification', params: {} }
      await transport.send(message)
      
      expect(mockWs.send).not.toHaveBeenCalled()
      expect(ondisconnectionSpy).toHaveBeenCalledWith('mock-client-id')
      expect(transport.getConnectedClients().length).toBe(0)
    })
  })
  
  describe('broadcast', () => {
    it('should call send method', async () => {
      const sendSpy = jest.spyOn(transport, 'send').mockResolvedValue()
      
      const message = { jsonrpc: '2.0', id: 'broadcast', method: 'notification', params: {} }
      await transport.broadcast(message)
      
      expect(sendSpy).toHaveBeenCalledWith(message)
    })
  })
  
  describe('client management methods', () => {
    beforeEach(async () => {
      await transport.start()
      mockWss.emit('connection', mockWs)
    })
    
    it('should return connected clients', () => {
      const clients = transport.getConnectedClients()
      
      expect(clients.length).toBe(1)
      expect(clients[0].clientId).toBe('mock-client-id')
      expect(clients[0].readyState).toBe(WebSocket.OPEN)
    })
    
    it('should return client count', () => {
      expect(transport.getClientCount()).toBe(1)
    })
    
    it('should get client by ID', () => {
      const client = transport.getClientById('mock-client-id')
      
      expect(client).toBe(mockWs)
    })
    
    it('should send message to specific client by ID', async () => {
      const message = { jsonrpc: '2.0', id: 'direct', method: 'test', params: {} }
      const result = await transport.sendToClient('mock-client-id', message)
      
      expect(result).toBe(true)
      expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify(message))
    })
    
    it('should return false when sending to non-existent client', async () => {
      const message = { jsonrpc: '2.0', id: 'direct', method: 'test', params: {} }
      const result = await transport.sendToClient('non-existent', message)
      
      expect(result).toBe(false)
      expect(mockWs.send).not.toHaveBeenCalled()
    })
    
    it('should disconnect client', () => {
      const result = transport.disconnectClient('mock-client-id')
      
      expect(result).toBe(true)
      expect(mockWs.close).toHaveBeenCalled()
      expect(transport.getClientCount()).toBe(0)
    })
    
    it('should return false when disconnecting non-existent client', () => {
      const result = transport.disconnectClient('non-existent')
      
      expect(result).toBe(false)
      expect(mockWs.close).not.toHaveBeenCalled()
      expect(transport.getClientCount()).toBe(1)
    })
  })
  
  describe('close', () => {
    it('should close all connections and the server', async () => {
      await transport.start()
      mockWss.emit('connection', mockWs)
      
      await transport.close()
      
      expect(mockWss.close).toHaveBeenCalled()
      expect(transport.getClientCount()).toBe(0)
    })
  })
})

