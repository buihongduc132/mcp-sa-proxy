import { onSignals } from '../onSignals.js'
import { Logger } from '../../types.js'

describe('onSignals', () => {
  let mockLogger: Logger
  let mockCleanup: jest.Mock
  let processExitSpy: jest.SpyInstance
  let processOnSpy: jest.SpyInstance
  let stdinOnSpy: jest.SpyInstance

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
    }
    mockCleanup = jest.fn()
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    processOnSpy = jest.spyOn(process, 'on').mockImplementation((event, handler) => process)
    stdinOnSpy = jest.spyOn(process.stdin, 'on').mockImplementation((event, handler) => process.stdin)
  })

  afterEach(() => {
    jest.clearAllMocks()
    processExitSpy.mockRestore()
    processOnSpy.mockRestore()
    stdinOnSpy.mockRestore()
  })

  it('should register signal handlers for SIGINT, SIGTERM, and SIGHUP', () => {
    onSignals({ logger: mockLogger, cleanup: mockCleanup })
    
    expect(processOnSpy).toHaveBeenCalledTimes(3)
    expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function))
    expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function))
    expect(processOnSpy).toHaveBeenCalledWith('SIGHUP', expect.any(Function))
  })

  it('should register stdin close handler', () => {
    onSignals({ logger: mockLogger, cleanup: mockCleanup })
    
    expect(stdinOnSpy).toHaveBeenCalledWith('close', expect.any(Function))
  })

  it('should call cleanup and exit when SIGINT is received', () => {
    onSignals({ logger: mockLogger, cleanup: mockCleanup })
    
    // Extract the SIGINT handler
    const sigintHandler = processOnSpy.mock.calls.find(call => call[0] === 'SIGINT')?.[1]
    
    if (sigintHandler) {
      sigintHandler()
      
      expect(mockLogger.info).toHaveBeenCalledWith('Caught SIGINT. Exiting...')
      expect(mockCleanup).toHaveBeenCalled()
      expect(processExitSpy).toHaveBeenCalledWith(0)
    } else {
      fail('SIGINT handler not found')
    }
  })

  it('should call cleanup and exit when SIGTERM is received', () => {
    onSignals({ logger: mockLogger, cleanup: mockCleanup })
    
    // Extract the SIGTERM handler
    const sigtermHandler = processOnSpy.mock.calls.find(call => call[0] === 'SIGTERM')?.[1]
    
    if (sigtermHandler) {
      sigtermHandler()
      
      expect(mockLogger.info).toHaveBeenCalledWith('Caught SIGTERM. Exiting...')
      expect(mockCleanup).toHaveBeenCalled()
      expect(processExitSpy).toHaveBeenCalledWith(0)
    } else {
      fail('SIGTERM handler not found')
    }
  })

  it('should call cleanup and exit when stdin is closed', () => {
    onSignals({ logger: mockLogger, cleanup: mockCleanup })
    
    // Extract the stdin close handler
    const stdinCloseHandler = stdinOnSpy.mock.calls.find(call => call[0] === 'close')?.[1]
    
    if (stdinCloseHandler) {
      stdinCloseHandler()
      
      expect(mockLogger.info).toHaveBeenCalledWith('stdin closed. Exiting...')
      expect(mockCleanup).toHaveBeenCalled()
      expect(processExitSpy).toHaveBeenCalledWith(0)
    } else {
      fail('stdin close handler not found')
    }
  })

  it('should work without cleanup function', () => {
    onSignals({ logger: mockLogger })
    
    // Extract the SIGINT handler
    const sigintHandler = processOnSpy.mock.calls.find(call => call[0] === 'SIGINT')?.[1]
    
    if (sigintHandler) {
      sigintHandler()
      
      expect(mockLogger.info).toHaveBeenCalledWith('Caught SIGINT. Exiting...')
      expect(processExitSpy).toHaveBeenCalledWith(0)
    } else {
      fail('SIGINT handler not found')
    }
  })
})

