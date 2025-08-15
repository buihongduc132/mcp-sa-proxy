import { getLogger } from '../getLogger.js'

describe('getLogger', () => {
  let consoleLogSpy: jest.SpyInstance
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  it('should return noneLogger when logLevel is none', () => {
    const logger = getLogger({ logLevel: 'none', outputTransport: 'sse' })
    
    logger.info('test info')
    logger.error('test error')
    logger.debug('test debug')
    logger.warn('test warn')
    
    expect(consoleLogSpy).not.toHaveBeenCalled()
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it('should return infoLogger when logLevel is info and outputTransport is not stdio', () => {
    const logger = getLogger({ logLevel: 'info', outputTransport: 'sse' })
    
    logger.info('test info')
    logger.error('test error')
    logger.debug('test debug')
    logger.warn('test warn')
    
    expect(consoleLogSpy).toHaveBeenCalledWith('[mcp-superassistant-proxy]', 'test info')
    expect(consoleErrorSpy).toHaveBeenCalledWith('[mcp-superassistant-proxy]', 'test error')
    expect(consoleErrorSpy).toHaveBeenCalledWith('[mcp-superassistant-proxy]', 'test warn')
    expect(consoleLogSpy).toHaveBeenCalledTimes(1)
    expect(consoleErrorSpy).toHaveBeenCalledTimes(2)
  })

  it('should return infoLoggerStdio when logLevel is info and outputTransport is stdio', () => {
    const logger = getLogger({ logLevel: 'info', outputTransport: 'stdio' })
    
    logger.info('test info')
    logger.error('test error')
    logger.debug('test debug')
    logger.warn('test warn')
    
    expect(consoleLogSpy).not.toHaveBeenCalled()
    expect(consoleErrorSpy).toHaveBeenCalledWith('[mcp-superassistant-proxy]', 'test info')
    expect(consoleErrorSpy).toHaveBeenCalledWith('[mcp-superassistant-proxy]', 'test error')
    expect(consoleErrorSpy).toHaveBeenCalledWith('[mcp-superassistant-proxy]', 'test warn')
    expect(consoleErrorSpy).toHaveBeenCalledTimes(3)
  })

  it('should return debugLogger when logLevel is debug and outputTransport is not stdio', () => {
    const logger = getLogger({ logLevel: 'debug', outputTransport: 'sse' })
    
    logger.info('test info')
    logger.error('test error')
    logger.debug('test debug')
    logger.warn('test warn')
    
    expect(consoleLogSpy).toHaveBeenCalledTimes(2)
    expect(consoleErrorSpy).toHaveBeenCalledTimes(2)
  })

  it('should return debugLoggerStdio when logLevel is debug and outputTransport is stdio', () => {
    const logger = getLogger({ logLevel: 'debug', outputTransport: 'stdio' })
    
    logger.info('test info')
    logger.error('test error')
    logger.debug('test debug')
    logger.warn('test warn')
    
    expect(consoleLogSpy).not.toHaveBeenCalled()
    expect(consoleErrorSpy).toHaveBeenCalledTimes(4)
  })

  it('should format objects in debug mode', () => {
    const logger = getLogger({ logLevel: 'debug', outputTransport: 'sse' })
    const testObj = { key: 'value' }
    
    logger.debug('test debug', testObj)
    
    expect(consoleLogSpy).toHaveBeenCalled()
  })
})

