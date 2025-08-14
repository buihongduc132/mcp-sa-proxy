import { readFileSync } from 'fs'
import { z } from 'zod'
import { detectServerType, loadConfig, McpServerConfig } from '../config.js'

jest.mock('fs', () => ({
  readFileSync: jest.fn(),
}))

describe('config', () => {
  const mockReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('detectServerType', () => {
    it('should return the explicitly specified type', () => {
      const config: McpServerConfig = {
        type: 'stdio',
        url: 'http://example.com/mcp',
      }
      
      expect(detectServerType(config)).toBe('stdio')
    })

    it('should detect streamable-http from URL with /mcp path', () => {
      const config: McpServerConfig = {
        url: 'http://example.com/mcp',
      }
      
      expect(detectServerType(config)).toBe('streamable-http')
    })

    it('should detect sse from URL with /sse path', () => {
      const config: McpServerConfig = {
        url: 'http://example.com/sse',
      }
      
      expect(detectServerType(config)).toBe('sse')
    })

    it('should default to streamable-http for unrecognized HTTP endpoints', () => {
      const config: McpServerConfig = {
        url: 'http://example.com/api',
      }
      
      expect(detectServerType(config)).toBe('streamable-http')
    })

    it('should default to streamable-http for invalid URLs', () => {
      const config: McpServerConfig = {
        url: 'invalid-url',
      }
      
      expect(detectServerType(config)).toBe('streamable-http')
    })

    it('should detect stdio when command is specified', () => {
      const config: McpServerConfig = {
        command: 'node',
        args: ['server.js'],
      }
      
      expect(detectServerType(config)).toBe('stdio')
    })

    it('should throw error when type cannot be detected', () => {
      const config: McpServerConfig = {
        name: 'test-server',
      }
      
      expect(() => detectServerType(config)).toThrow(
        'Cannot detect server type for test-server. Please specify type explicitly.'
      )
    })
  })

  describe('loadConfig', () => {
    it('should load and parse a valid config file', () => {
      const validConfig = {
        mcpServers: {
          server1: {
            name: 'Server 1',
            type: 'stdio',
            command: 'node',
            args: ['server.js'],
          },
          server2: {
            name: 'Server 2',
            url: 'http://example.com/mcp',
          },
        },
      }
      
      mockReadFileSync.mockReturnValue(JSON.stringify(validConfig))
      
      const result = loadConfig('config.json')
      
      expect(result).toEqual(validConfig)
      expect(mockReadFileSync).toHaveBeenCalledWith('config.json', 'utf8')
    })

    it('should throw error for invalid JSON', () => {
      mockReadFileSync.mockReturnValue('invalid json')
      
      expect(() => loadConfig('config.json')).toThrow('Invalid JSON in config file:')
      expect(mockReadFileSync).toHaveBeenCalledWith('config.json', 'utf8')
    })

    it('should throw error for invalid config format', () => {
      const invalidConfig = {
        // Missing mcpServers
        wrongKey: {},
      }
      
      mockReadFileSync.mockReturnValue(JSON.stringify(invalidConfig))
      
      expect(() => loadConfig('config.json')).toThrow('Invalid config format:')
      expect(mockReadFileSync).toHaveBeenCalledWith('config.json', 'utf8')
    })

    it('should throw error for invalid server config', () => {
      const invalidServerConfig = {
        mcpServers: {
          server1: {
            type: 'invalid-type', // Invalid type
          },
        },
      }
      
      mockReadFileSync.mockReturnValue(JSON.stringify(invalidServerConfig))
      
      expect(() => loadConfig('config.json')).toThrow('Invalid config format:')
      expect(mockReadFileSync).toHaveBeenCalledWith('config.json', 'utf8')
    })

    it('should throw error when file cannot be read', () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('File not found')
      })
      
      expect(() => loadConfig('config.json')).toThrow('Failed to load config: Error: File not found')
      expect(mockReadFileSync).toHaveBeenCalledWith('config.json', 'utf8')
    })
  })
})

