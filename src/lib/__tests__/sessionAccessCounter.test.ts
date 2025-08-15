import { SessionAccessCounter } from '../sessionAccessCounter.js'

describe('SessionAccessCounter', () => {
  let onTimeoutMock: jest.Mock
  let sessionAccessCounter: SessionAccessCounter
  
  beforeEach(() => {
    jest.useFakeTimers()
    onTimeoutMock = jest.fn()
  })
  
  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
  })
  
  it('should increment access count and clear timeout', () => {
    sessionAccessCounter = new SessionAccessCounter(1000, onTimeoutMock)
    
    sessionAccessCounter.inc()
    sessionAccessCounter.dec() // This should start the timeout
    
    // Increment again to clear the timeout
    sessionAccessCounter.inc()
    
    jest.advanceTimersByTime(2000)
    
    expect(onTimeoutMock).not.toHaveBeenCalled()
  })
  
  it('should decrement access count and start timeout when count reaches 0', () => {
    sessionAccessCounter = new SessionAccessCounter(1000, onTimeoutMock)
    
    sessionAccessCounter.inc()
    sessionAccessCounter.dec() // Count reaches 0, timeout should start
    
    jest.advanceTimersByTime(500)
    expect(onTimeoutMock).not.toHaveBeenCalled()
    
    jest.advanceTimersByTime(500)
    expect(onTimeoutMock).toHaveBeenCalledTimes(1)
  })
  
  it('should not start timeout if timeout value is 0 or negative', () => {
    sessionAccessCounter = new SessionAccessCounter(0, onTimeoutMock)
    
    sessionAccessCounter.inc()
    sessionAccessCounter.dec() // Count reaches 0, but timeout should not start
    
    jest.advanceTimersByTime(2000)
    expect(onTimeoutMock).not.toHaveBeenCalled()
  })
  
  it('should clear timeout when clear() is called', () => {
    sessionAccessCounter = new SessionAccessCounter(1000, onTimeoutMock)
    
    sessionAccessCounter.inc()
    sessionAccessCounter.dec() // Count reaches 0, timeout should start
    
    sessionAccessCounter.clear() // Should clear the timeout
    
    jest.advanceTimersByTime(2000)
    expect(onTimeoutMock).not.toHaveBeenCalled()
  })
  
  it('should handle multiple increments and decrements correctly', () => {
    sessionAccessCounter = new SessionAccessCounter(1000, onTimeoutMock)
    
    sessionAccessCounter.inc()
    sessionAccessCounter.inc()
    sessionAccessCounter.dec() // Count is 1, no timeout yet
    
    jest.advanceTimersByTime(2000)
    expect(onTimeoutMock).not.toHaveBeenCalled()
    
    sessionAccessCounter.dec() // Count reaches 0, timeout should start
    
    jest.advanceTimersByTime(500)
    expect(onTimeoutMock).not.toHaveBeenCalled()
    
    jest.advanceTimersByTime(500)
    expect(onTimeoutMock).toHaveBeenCalledTimes(1)
  })
  
  it('should restart timeout when decrementing to 0 multiple times', () => {
    sessionAccessCounter = new SessionAccessCounter(1000, onTimeoutMock)
    
    sessionAccessCounter.inc()
    sessionAccessCounter.dec() // Count reaches 0, timeout should start
    
    jest.advanceTimersByTime(500) // Half the timeout has passed
    
    sessionAccessCounter.inc()
    sessionAccessCounter.dec() // Count reaches 0 again, timeout should restart
    
    jest.advanceTimersByTime(500) // This would trigger the first timeout, but it was cleared
    expect(onTimeoutMock).not.toHaveBeenCalled()
    
    jest.advanceTimersByTime(500) // Only half of the new timeout has passed
    expect(onTimeoutMock).not.toHaveBeenCalled()
    
    jest.advanceTimersByTime(500) // Now the new timeout should trigger
    expect(onTimeoutMock).toHaveBeenCalledTimes(1)
  })
})

