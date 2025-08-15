import { configToSse } from '../configToSse.js'
import express from 'express'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { McpServerManager } from '../../lib/mcpServerManager.js'
import { loadConfig } from '../../lib/config.js'
import { onSignals } from '../../lib/onSignals.js'
import { getVersion } from '../../lib/getVersion.js'
import { Logger } from '../../types.js'

// Mock dependencies
jest.mock('express', () => {
  const mockApp = {
    use: jest.fn().mockReturnThis(),
    get: jest.fn().mockReturnThis(),
    post: jest.fn().mockReturnThis(),
    listen: jest.fn().mockImplementation((port, host, callback) => {
      callback()
      return { close: jest.fn() }
    }),
  }
  
  return jest.fn(() => mockApp)
})

jest.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: jest.fn(),
}))

jest.mock('@modelcontextprotocol/sdk/server/sse.js', () => ({
  SSEServerTransport: jest.fn().mockImplementation(() => ({
    sessionId: 'test-session-id',
    send: jest.fn(),
    handlePostMessage: jest.fn(),
    onmessage: null,
    onclose: null,
    onerror: null,
  })),
}))

jest.mock('../../lib/mcpServerManager.js')
jest.mock('../../lib/config.js')
jest.mock('../../lib/onSignals.js')
jest.mock('../../lib/getVersion.js')

describe('configToSse', () => {
  let mockLogger: Logger
  let mockServerManager: jest.Mocked<McpServerManager>
  let mockServer: any
  let mockApp: any
  let mockConfig: any
  
  beforeEach(() => {
    jest.clearAllMocks()
    
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
    }
    
    mockServerManager = new McpServerManager(mockLogger) as jest.Mocked<McpServerManager>
    mockServerManager.addServer = jest.fn().mockResolvedValue(undefined)
    mockServerManager.handleRequest = jest.fn().mockResolvedValue({
      jsonrpc: '2.0',
      id: 1,
      result: {},
    })
    mockServerManager.cleanup = jest.fn().mockResolvedValue(undefined)
    
    ;(McpServerManager as jest.Mock).mockImplementation(() => mockServerManager)
    
    mockServer = {
      connect: jest.fn().mockResolvedValue(undefined),
    }
    ;(Server as jest.Mock).mockImplementation(() => mockServer)
    
    mockApp = express()
    
    mockConfig = {
      mcpServers: {
        server1: {
          command: 'node',
          args: ['server.js'],
        },
        server2: {
          url: 'http://example.com/mcp',
        },
      },
    }
    ;(loadConfig as jest.Mock).mockReturnValue(mockConfig)
    ;(getVersion as jest.Mock).mockReturnValue('1.0.0')
  })
  
  it('should initialize the gateway with the provided configuration', async () => {
    await configToSse({
      configPath: 'config.json',
      port: 3000,
      host: 'localhost',
      baseUrl: '',
      ssePath: '/sse',
      messagePath: '/message',
      logger: mockLogger,
      corsOrigin: '*',
      healthEndpoints: ['/health'],
      headers: { 'X-Test': 'value' },
    })
    
    // Verify config loading
    expect(loadConfig).toHaveBeenCalledWith('config.json')
    
    // Verify server initialization
    expect(mockServerManager.addServer).toHaveBeenCalledTimes(2)
    expect(mockServerManager.addServer).toHaveBeenCalledWith('server1', mockConfig.mcpServers.server1)
    expect(mockServerManager.addServer).toHaveBeenCalledWith('server2', mockConfig.mcpServers.server2)
    
    // Verify express setup
    expect(mockApp.use).toHaveBeenCalled()
    expect(mockApp.get).toHaveBeenCalledWith('/health', expect.any(Function))
    expect(mockApp.get).toHaveBeenCalledWith('/sse', expect.any(Function))
    expect(mockApp.post).toHaveBeenCalledWith('/message', expect.any(Function))
    expect(mockApp.listen).toHaveBeenCalledWith(3000, 'localhost', expect.any(Function))
    
    // Verify signal handlers
    expect(onSignals).toHaveBeenCalledWith({
      logger: mockLogger,
      cleanup: expect.any(Function),
    })
  })
  
  it('should handle SSE connection requests', async () => {
    await configToSse({
      configPath: 'config.json',
      port: 3000,
      host: 'localhost',
      baseUrl: '',
      ssePath: '/sse',
      messagePath: '/message',
      logger: mockLogger,
      corsOrigin: '*',
      healthEndpoints: [],
      headers: {},
    })
    
    // Extract the SSE handler
    const sseHandler = mockApp.get.mock.calls.find(call => call[0] === '/sse')?.[1]
    
    if (!sseHandler) {
      fail('SSE handler not found')
      return
    }
    
    // Mock request and response
    const mockReq = {
      ip: '127.0.0.1',
      on: jest.fn(),
    }
    
    const mockRes = {
      setHeader: jest.fn(),
    }
    
    // Call the handler
    await sseHandler(mockReq, mockRes)
    
    // Verify SSE transport setup
    expect(SSEServerTransport).toHaveBeenCalledWith('/message', mockRes)
    expect(mockServer.connect).toHaveBeenCalled()
    
    // Get the transport instance
    const transport = (SSEServerTransport as jest.Mock).mock.results[0].value
    
    // Simulate a message from the client
    const message = { jsonrpc: '2.0', id: 1, method: 'test', params: {} }
    transport.onmessage(message)
    
    // Verify request handling
    expect(mockServerManager.handleRequest).toHaveBeenCalledWith(message)
    expect(transport.send).toHaveBeenCalled()
    
    // Simulate connection close
    transport.onclose()
    
    // Verify cleanup
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('SSE connection closed'))
  })
  
  it('should handle POST message requests', async () => {
    await configToSse({
      configPath: 'config.json',
      port: 3000,
      host: 'localhost',
      baseUrl: '',
      ssePath: '/sse',
      messagePath: '/message',
      logger: mockLogger,
      corsOrigin: '*',
      healthEndpoints: [],
      headers: {},
    })
    
    // Extract the POST handler
    const postHandler = mockApp.post.mock.calls.find(call => call[0] === '/message')?.[1]
    
    if (!postHandler) {
      fail('POST handler not found')
      return
    }
    
    // First, simulate an SSE connection to create a session
    const sseHandler = mockApp.get.mock.calls.find(call => call[0] === '/sse')?.[1]
    const mockSseReq = { ip: '127.0.0.1', on: jest.fn() }
    const mockSseRes = { setHeader: jest.fn() }
    await sseHandler(mockSseReq, mockSseRes)
    
    // Now simulate a POST request
    const mockPostReq = {
      query: { sessionId: 'test-session-id' },
      body: { jsonrpc: '2.0', id: 2, method: 'test', params: {} },
    }
    
    const mockPostRes = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    }
    
    // Call the handler
    await postHandler(mockPostReq, mockPostRes)
    
    // Get the transport instance
    const transport = (SSEServerTransport as jest.Mock).mock.results[0].value
    
    // Verify handlePostMessage was called
    expect(transport.handlePostMessage).toHaveBeenCalledWith(mockPostReq, mockPostRes)
  })
  
  it('should handle missing sessionId in POST requests', async () => {
    await configToSse({
      configPath: 'config.json',
      port: 3000,
      host: 'localhost',
      baseUrl: '',
      ssePath: '/sse',
      messagePath: '/message',
      logger: mockLogger,
      corsOrigin: '*',
      healthEndpoints: [],
      headers: {},
    })
    
    // Extract the POST handler
    const postHandler = mockApp.post.mock.calls.find(call => call[0] === '/message')?.[1]
    
    if (!postHandler) {
      fail('POST handler not found')
      return
    }
    
    // Simulate a POST request without sessionId
    const mockPostReq = {
      query: {},
      body: { jsonrpc: '2.0', id: 2, method: 'test', params: {} },
    }
    
    const mockPostRes = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    }
    
    // Call the handler
    await postHandler(mockPostReq, mockPostRes)
    
    // Verify error response
    expect(mockPostRes.status).toHaveBeenCalledWith(400)
    expect(mockPostRes.send).toHaveBeenCalledWith('Missing sessionId parameter')
  })
  
  it('should handle invalid session in POST requests', async () => {
    await configToSse({
      configPath: 'config.json',
      port: 3000,
      host: 'localhost',
      baseUrl: '',
      ssePath: '/sse',
      messagePath: '/message',
      logger: mockLogger,
      corsOrigin: '*',
      healthEndpoints: [],
      headers: {},
    })
    
    // Extract the POST handler
    const postHandler = mockApp.post.mock.calls.find(call => call[0] === '/message')?.[1]
    
    if (!postHandler) {
      fail('POST handler not found')
      return
    }
    
    // Simulate a POST request with invalid sessionId
    const mockPostReq = {
      query: { sessionId: 'invalid-session-id' },
      body: { jsonrpc: '2.0', id: 2, method: 'test', params: {} },
    }
    
    const mockPostRes = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    }
    
    // Call the handler
    await postHandler(mockPostReq, mockPostRes)
    
    // Verify error response
    expect(mockPostRes.status).toHaveBeenCalledWith(503)
    expect(mockPostRes.send).toHaveBeenCalledWith('No active SSE connection for session invalid-session-id')
  })
  
  it('should handle errors during server initialization', async () => {
    // Mock process.exit
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    
    // Make the second server fail to initialize
    mockServerManager.addServer
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Connection failed'))
    
    await configToSse({
      configPath: 'config.json',
      port: 3000,
      host: 'localhost',
      baseUrl: '',
      ssePath: '/sse',
      messagePath: '/message',
      logger: mockLogger,
      corsOrigin: '*',
      healthEndpoints: [],
      headers: {},
    })
    
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to initialize server server2')
    )
    expect(mockExit).toHaveBeenCalledWith(1)
    
    mockExit.mockRestore()
  })
  
  it('should handle errors during config loading', async () => {
    // Mock process.exit
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    
    // Make config loading fail
    ;(loadConfig as jest.Mock).mockImplementation(() => {
      throw new Error('Invalid config')
    })
    
    await configToSse({
      configPath: 'config.json',
      port: 3000,
      host: 'localhost',
      baseUrl: '',
      ssePath: '/sse',
      messagePath: '/message',
      logger: mockLogger,
      corsOrigin: '*',
      healthEndpoints: [],
      headers: {},
    })
    
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to load config')
    )
    expect(mockExit).toHaveBeenCalledWith(1)
    
    mockExit.mockRestore()
  })
  
  it('should handle errors during request processing', async () => {
    await configToSse({
      configPath: 'config.json',
      port: 3000,
      host: 'localhost',
      baseUrl: '',
      ssePath: '/sse',
      messagePath: '/message',
      logger: mockLogger,
      corsOrigin: '*',
      healthEndpoints: [],
      headers: {},
    })
    
    // Extract the SSE handler
    const sseHandler = mockApp.get.mock.calls.find(call => call[0] === '/sse')?.[1]
    
    if (!sseHandler) {
      fail('SSE handler not found')
      return
    }
    
    // Mock request and response
    const mockReq = {
      ip: '127.0.0.1',
      on: jest.fn(),
    }
    
    const mockRes = {
      setHeader: jest.fn(),
    }
    
    // Call the handler
    await sseHandler(mockReq, mockRes)
    
    // Get the transport instance
    const transport = (SSEServerTransport as jest.Mock).mock.results[0].value
    
    // Make the server manager throw an error
    mockServerManager.handleRequest.mockRejectedValueOnce(new Error('Processing error'))
    
    // Simulate a message from the client
    const message = { jsonrpc: '2.0', id: 1, method: 'test', params: {} }
    await transport.onmessage(message)
    
    // Verify error handling
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Error handling request in session'),
      expect.any(Error)
    )
    expect(transport.send).toHaveBeenCalledWith({
      jsonrpc: '2.0',
      id: 1,
      error: {
        code: -32000,
        message: 'Internal error',
      },
    })
  })
})

