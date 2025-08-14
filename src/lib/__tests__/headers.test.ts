import { headers } from '../headers.js'
import { Logger } from '../../types.js'

describe('headers', () => {
  let mockLogger: Logger

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
    }
  })

  it('should parse headers from argv.header', () => {
    const result = headers({
      argv: {
        header: ['Content-Type: application/json', 'X-Custom-Header: value'],
        oauth2Bearer: undefined,
      },
      logger: mockLogger,
    })

    expect(result).toEqual({
      'Content-Type': 'application/json',
      'X-Custom-Header': 'value',
    })
  })

  it('should add Authorization header when oauth2Bearer is provided', () => {
    const result = headers({
      argv: {
        header: ['Content-Type: application/json'],
        oauth2Bearer: 'token123',
      },
      logger: mockLogger,
    })

    expect(result).toEqual({
      'Content-Type': 'application/json',
      'Authorization': 'Bearer token123',
    })
  })

  it('should handle empty header array', () => {
    const result = headers({
      argv: {
        header: [],
        oauth2Bearer: undefined,
      },
      logger: mockLogger,
    })

    expect(result).toEqual({})
  })

  it('should log error and ignore invalid header format without colon', () => {
    const result = headers({
      argv: {
        header: ['InvalidHeader', 'Valid-Header: value'],
        oauth2Bearer: undefined,
      },
      logger: mockLogger,
    })

    expect(result).toEqual({
      'Valid-Header': 'value',
    })
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Invalid header format: InvalidHeader, ignoring'
    )
  })

  it('should log error and ignore header with empty key', () => {
    const result = headers({
      argv: {
        header: [': value', 'Valid-Header: value'],
        oauth2Bearer: undefined,
      },
      logger: mockLogger,
    })

    expect(result).toEqual({
      'Valid-Header': 'value',
    })
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Invalid header format: : value, ignoring'
    )
  })

  it('should log error and ignore header with empty value', () => {
    const result = headers({
      argv: {
        header: ['Empty-Value:', 'Valid-Header: value'],
        oauth2Bearer: undefined,
      },
      logger: mockLogger,
    })

    expect(result).toEqual({
      'Valid-Header': 'value',
    })
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Invalid header format: Empty-Value:, ignoring'
    )
  })

  it('should handle numeric values in header array', () => {
    const result = headers({
      argv: {
        header: ['X-Number: 123', 456],
        oauth2Bearer: undefined,
      },
      logger: mockLogger,
    })

    expect(result).toEqual({
      'X-Number': '123',
    })
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Invalid header format: 456, ignoring'
    )
  })
})

