import { McpServerManager } from '../mcpServerManager.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { getVersion } from '../getVersion.js'
import { Logger } from '../../types.js'

// Mock the SDK modules
jest.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: jest.fn(),
}))
jest.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: jest.fn(),
}))
jest.mock('@modelcontextprotocol/sdk/client/sse.js', () => ({
  SSEClientTransport: jest.fn(),
}))
jest.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: jest.fn(),
}))
jest.mock('../getVersion.js', () => ({
  getVersion: jest.fn(),
}))

describe('McpServerManager', () => {
  let mockLogger: Logger
  let serverManager: McpServerManager
  let mockClient: any
  
  beforeEach(() => {
    jest.clearAllMocks()
    
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
    }
    
    mockClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      request: jest.fn(),
    }
    
    ;(Client as jest.Mock).mockImplementation(() => mockClient)
    ;(getVersion as jest.Mock).mockReturnValue('1.0.0')
    
    serverManager = new McpServerManager(mockLogger)
  })
  
  describe('addServer', () => {
    it('should add a stdio server successfully', async () => {
      mockClient.request
        .mockResolvedValueOnce({ tools: [{ name: 'tool1' }] })
        .mockResolvedValueOnce({ resources: [{ name: 'resource1', uri: 'res1' }] })
      
      await serverManager.addServer('test-server', {
        command: 'node',
        args: ['server.js'],
        env: { TEST_ENV: 'value' },
      })
      
      expect(StdioClientTransport).toHaveBeenCalledWith({
        command: 'node',
        args: ['server.js'],
        env: expect.objectContaining({ TEST_ENV: 'value' }),
      })
      
      expect(Client).toHaveBeenCalledWith(
        {
          name: 'mcp-superassistant-proxy',
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      )
      
      expect(mockClient.connect).toHaveBeenCalled()
      expect(mockClient.request).toHaveBeenCalledTimes(2)
      
      const servers = serverManager.getServers()
      expect(servers.size).toBe(1)
      expect(servers.has('test-server')).toBe(true)
      
      const server = servers.get('test-server')
      expect(server).toBeDefined()
      expect(server?.tools).toEqual([{ name: 'tool1' }])
      expect(server?.resources).toEqual([{ name: 'resource1', uri: 'res1' }])
      expect(server?.connected).toBe(true)
    })
    
    it('should add an SSE server successfully', async () => {
      mockClient.request
        .mockResolvedValueOnce({ tools: [{ name: 'tool1' }] })
        .mockResolvedValueOnce({ resources: [{ name: 'resource1', uri: 'res1' }] })
      
      await serverManager.addServer('test-server', {
        url: 'http://example.com/sse',
        headers: { 'X-API-Key': 'test-key' },
      })
      
      expect(SSEClientTransport).toHaveBeenCalledWith(
        expect.any(URL),
        expect.objectContaining({
          eventSourceInit: expect.any(Object),
          requestInit: {
            headers: { 'X-API-Key': 'test-key' },
          },
        })
      )
      
      expect(mockClient.connect).toHaveBeenCalled()
      
      const servers = serverManager.getServers()
      expect(servers.size).toBe(1)
      expect(servers.has('test-server')).toBe(true)
    })
    
    it('should add a streamable HTTP server successfully', async () => {
      mockClient.request
        .mockResolvedValueOnce({ tools: [{ name: 'tool1' }] })
        .mockResolvedValueOnce({ resources: [{ name: 'resource1', uri: 'res1' }] })
      
      await serverManager.addServer('test-server', {
        url: 'http://example.com/mcp',
        headers: { 'X-API-Key': 'test-key' },
      })
      
      expect(StreamableHTTPClientTransport).toHaveBeenCalledWith(
        expect.any(URL),
        expect.objectContaining({
          requestInit: {
            headers: { 'X-API-Key': 'test-key' },
          },
        })
      )
      
      expect(mockClient.connect).toHaveBeenCalled()
      
      const servers = serverManager.getServers()
      expect(servers.size).toBe(1)
      expect(servers.has('test-server')).toBe(true)
    })
    
    it('should handle errors when tools/list fails', async () => {
      mockClient.request
        .mockRejectedValueOnce(new Error('Tools not supported'))
        .mockResolvedValueOnce({ resources: [{ name: 'resource1', uri: 'res1' }] })
      
      await serverManager.addServer('test-server', {
        command: 'node',
        args: ['server.js'],
      })
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Server test-server does not support tools')
      )
      
      const servers = serverManager.getServers()
      expect(servers.size).toBe(1)
      
      const server = servers.get('test-server')
      expect(server).toBeDefined()
      expect(server?.tools).toEqual([])
      expect(server?.resources).toEqual([{ name: 'resource1', uri: 'res1' }])
    })
    
    it('should handle errors when resources/list fails', async () => {
      mockClient.request
        .mockResolvedValueOnce({ tools: [{ name: 'tool1' }] })
        .mockRejectedValueOnce(new Error('Resources not supported'))
      
      await serverManager.addServer('test-server', {
        command: 'node',
        args: ['server.js'],
      })
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Server test-server does not support resources')
      )
      
      const servers = serverManager.getServers()
      expect(servers.size).toBe(1)
      
      const server = servers.get('test-server')
      expect(server).toBeDefined()
      expect(server?.tools).toEqual([{ name: 'tool1' }])
      expect(server?.resources).toEqual([])
    })
    
    it('should throw error when stdio server is missing command', async () => {
      await expect(serverManager.addServer('test-server', {}))
        .rejects.toThrow('Cannot detect server type for test-server')
    })
    
    it('should throw error when SSE server URL is invalid', async () => {
      await expect(
        serverManager.addServer('test-server', {
          type: 'sse',
          url: 'invalid-url',
        })
      ).rejects.toThrow()
    })
    
    it('should throw error when streamable HTTP server is missing URL', async () => {
      await expect(
        serverManager.addServer('test-server', {
          type: 'streamable-http',
        })
      ).rejects.toThrow('Streamable HTTP server test-server missing URL')
    })
    
    it('should throw error when server type is unsupported', async () => {
      await expect(
        serverManager.addServer('test-server', {
          // @ts-ignore - Testing invalid type
          type: 'unsupported',
        })
      ).rejects.toThrow('Cannot detect server type for test-server')
    })
  })
  
  describe('handleRequest', () => {
    beforeEach(async () => {
      // Set up a test server
      mockClient.request
        .mockResolvedValueOnce({ tools: [{ name: 'tool1' }] })
        .mockResolvedValueOnce({ resources: [{ name: 'resource1', uri: 'res1' }] })
      
      await serverManager.addServer('test-server', {
        command: 'node',
        args: ['server.js'],
      })
      
      // Reset the mock for subsequent tests
      mockClient.request.mockReset()
    })
    
    it('should handle initialize request', async () => {
      const response = await serverManager.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {},
      })
      
      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 1,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
            resources: {},
          },
          serverInfo: {
            name: 'mcp-superassistant-proxy-unified',
            version: '1.0.0',
          },
        },
      })
    })
    
    it('should handle tools/list request', async () => {
      const response = await serverManager.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      })
      
      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 1,
        result: {
          tools: [
            {
              name: 'test-server.tool1',
            },
          ],
        },
      })
    })
    
    it('should handle resources/list request', async () => {
      const response = await serverManager.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'resources/list',
        params: {},
      })
      
      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 1,
        result: {
          resources: [
            {
              name: 'test-server.resource1',
              uri: 'test-server://res1',
            },
          ],
        },
      })
    })
    
    it('should handle tools/call request with server prefix', async () => {
      mockClient.request.mockResolvedValueOnce({ result: 'success' })
      
      const response = await serverManager.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'test-server.tool1',
          arguments: { arg1: 'value1' },
        },
      })
      
      expect(mockClient.request).toHaveBeenCalledWith(
        {
          method: 'tools/call',
          params: {
            name: 'tool1',
            arguments: { arg1: 'value1' },
          },
        },
        expect.any(Object)
      )
      
      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 1,
        result: { result: 'success' },
      })
    })
    
    it('should handle resources/read request', async () => {
      mockClient.request.mockResolvedValueOnce({ content: 'resource content' })
      
      const response = await serverManager.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'resources/read',
        params: {
          uri: 'test-server://res1',
        },
      })
      
      expect(mockClient.request).toHaveBeenCalledWith(
        {
          method: 'resources/read',
          params: {
            uri: 'res1',
          },
        },
        expect.any(Object)
      )
      
      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 1,
        result: { content: 'resource content' },
      })
    })
    
    it('should return error for unknown method', async () => {
      const response = await serverManager.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'unknown/method',
        params: {},
      })
      
      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 1,
        error: {
          code: -32601,
          message: 'Method not found: unknown/method',
        },
      })
    })
    
    it('should return error when tool name is missing', async () => {
      const response = await serverManager.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {},
      })
      
      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 1,
        error: {
          code: -32602,
          message: 'Tool name is required',
        },
      })
    })
    
    it('should return error when resource URI is missing', async () => {
      const response = await serverManager.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'resources/read',
        params: {},
      })
      
      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 1,
        error: {
          code: -32602,
          message: 'Resource URI is required',
        },
      })
    })
    
    it('should return error when server is not found', async () => {
      const response = await serverManager.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'nonexistent-server.tool1',
        },
      })
      
      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 1,
        error: {
          code: -32601,
          message: 'Server nonexistent-server not found or not connected',
        },
      })
    })
    
    it('should return error when tool call fails', async () => {
      mockClient.request.mockRejectedValueOnce({
        code: -32000,
        message: 'Tool execution failed',
      })
      
      const response = await serverManager.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'test-server.tool1',
        },
      })
      
      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 1,
        error: {
          code: -32000,
          message: 'Tool execution failed',
        },
      })
    })
  })
  
  describe('cleanup', () => {
    it('should clean up all servers', async () => {
      const mockChild = {
        kill: jest.fn(),
      }
      
      // Add a server with a child process
      const servers = serverManager.getServers() as any
      servers.set('test-server', {
        name: 'test-server',
        connected: true,
        child: mockChild,
      })
      
      await serverManager.cleanup()
      
      expect(mockChild.kill).toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith('Cleaned up server: test-server')
      expect(servers.size).toBe(0)
    })
    
    it('should handle errors during cleanup', async () => {
      const mockChild = {
        kill: jest.fn().mockImplementation(() => {
          throw new Error('Kill failed')
        }),
      }
      
      // Add a server with a problematic child process
      const servers = serverManager.getServers() as any
      servers.set('test-server', {
        name: 'test-server',
        connected: true,
        child: mockChild,
      })
      
      await serverManager.cleanup()
      
      expect(mockChild.kill).toHaveBeenCalled()
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error cleaning up server test-server')
      )
      expect(servers.size).toBe(0)
    })
  })
})

