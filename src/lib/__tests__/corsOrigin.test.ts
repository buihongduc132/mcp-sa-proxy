import { corsOrigin } from '../corsOrigin.js'

describe('corsOrigin', () => {
  it('should return "*" when argv.cors is undefined', () => {
    const result = corsOrigin({ argv: { cors: undefined } })
    expect(result).toBe('*')
  })

  it('should return "*" when argv.cors is an empty array', () => {
    const result = corsOrigin({ argv: { cors: [] } })
    expect(result).toBe('*')
  })

  it('should return "*" when argv.cors includes "*"', () => {
    const result = corsOrigin({ argv: { cors: ['example.com', '*', 'localhost'] } })
    expect(result).toBe('*')
  })

  it('should return an array of origins when argv.cors is provided and does not include "*"', () => {
    const result = corsOrigin({ argv: { cors: ['example.com', 'localhost:3000'] } })
    expect(result).toEqual(['example.com', 'localhost:3000'])
  })

  it('should convert regex patterns to RegExp objects', () => {
    const result = corsOrigin({ argv: { cors: ['/example\\.com$/', 'localhost'] } })
    expect(result).toHaveLength(2)
    expect(result[0]).toBeInstanceOf(RegExp)
    expect(result[1]).toBe('localhost')
  })

  it('should handle invalid regex patterns by returning the original string', () => {
    const result = corsOrigin({ argv: { cors: ['/[invalid regex/', 'localhost'] } })
    expect(result).toHaveLength(2)
    expect(result[0]).toBe('/[invalid regex/')
    expect(result[1]).toBe('localhost')
  })

  it('should handle numeric values in cors array', () => {
    const result = corsOrigin({ argv: { cors: ['example.com', 123] } })
    expect(result).toEqual(['example.com', '123'])
  })
})

