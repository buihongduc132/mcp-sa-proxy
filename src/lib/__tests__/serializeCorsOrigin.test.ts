import { serializeCorsOrigin } from '../serializeCorsOrigin.js'

describe('serializeCorsOrigin', () => {
  it('should serialize string corsOrigin', () => {
    const result = serializeCorsOrigin({ corsOrigin: '*' })
    expect(result).toBe('"*"')
  })

  it('should serialize array of strings corsOrigin', () => {
    const result = serializeCorsOrigin({ corsOrigin: ['http://example.com', 'http://localhost:3000'] })
    expect(result).toBe('["http://example.com","http://localhost:3000"]')
  })

  it('should serialize RegExp in corsOrigin', () => {
    const result = serializeCorsOrigin({ corsOrigin: [/example\.com$/, 'http://localhost:3000'] })
    expect(result).toBe('["/example\\\\.com$/","http://localhost:3000"]')
  })

  it('should serialize function corsOrigin as undefined', () => {
    const corsOriginFn = (origin: string, callback: (err: Error | null, allow?: boolean) => void) => {
      callback(null, true)
    }
    const result = serializeCorsOrigin({ corsOrigin: corsOriginFn })
    expect(result).toBe('undefined')
  })

  it('should serialize mixed corsOrigin with RegExp and strings', () => {
    const result = serializeCorsOrigin({ corsOrigin: [/example\.com$/, 'http://localhost:3000', /\.test\.com$/] })
    expect(result).toBe('["/example\\\\.com$/","http://localhost:3000","/\\\\.test\\\\.com$/"]')
  })
})

