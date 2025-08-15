import { SessionManager } from '../sessionManager.js'
import { SessionAccessCounter } from '../sessionAccessCounter.js'

jest.mock('../sessionAccessCounter.js')

describe('SessionManager', () => {
  let sessionManager: SessionManager
  let mockSessionAccessCounter: jest.Mocked<SessionAccessCounter>
  let mockOnTimeout: jest.Mock
  
  beforeEach(() => {
    jest.clearAllMocks()
    mockOnTimeout = jest.fn()
    
    // Setup the mock implementation
    mockSessionAccessCounter = {
      inc: jest.fn(),
      dec: jest.fn(),
      clear: jest.fn(),
    } as unknown as jest.Mocked<SessionAccessCounter>
    
    // Make the constructor return our mock
    (SessionAccessCounter as jest.Mock).mockImplementation(() => mockSessionAccessCounter)
    
    sessionManager = new SessionManager(1000)
  })
  
  it('should create a new session with the specified timeout', () => {
    const sessionId = 'test-session-id'
    const session = sessionManager.createSession(sessionId, mockOnTimeout)
    
    expect(SessionAccessCounter).toHaveBeenCalledWith(1000, mockOnTimeout)
    expect(session).toBe(mockSessionAccessCounter)
  })
  
  it('should return the session for a valid session ID', () => {
    const sessionId = 'test-session-id'
    sessionManager.createSession(sessionId, mockOnTimeout)
    
    const session = sessionManager.getSession(sessionId)
    
    expect(session).toBe(mockSessionAccessCounter)
  })
  
  it('should return undefined for an invalid session ID', () => {
    const session = sessionManager.getSession('non-existent-session-id')
    
    expect(session).toBeUndefined()
  })
  
  it('should delete a session and clear its timeout', () => {
    const sessionId = 'test-session-id'
    sessionManager.createSession(sessionId, mockOnTimeout)
    
    sessionManager.deleteSession(sessionId)
    
    expect(mockSessionAccessCounter.clear).toHaveBeenCalled()
    expect(sessionManager.getSession(sessionId)).toBeUndefined()
  })
  
  it('should handle deleting a non-existent session', () => {
    // This should not throw an error
    sessionManager.deleteSession('non-existent-session-id')
    
    // The clear method should not have been called
    expect(mockSessionAccessCounter.clear).not.toHaveBeenCalled()
  })
  
  it('should manage multiple sessions independently', () => {
    const sessionId1 = 'test-session-id-1'
    const sessionId2 = 'test-session-id-2'
    const mockOnTimeout1 = jest.fn()
    const mockOnTimeout2 = jest.fn()
    
    // Create a new mock for the second session
    const mockSessionAccessCounter2 = {
      inc: jest.fn(),
      dec: jest.fn(),
      clear: jest.fn(),
    } as unknown as jest.Mocked<SessionAccessCounter>
    
    // Make the constructor return different mocks for each call
    (SessionAccessCounter as jest.Mock)
      .mockImplementationOnce(() => mockSessionAccessCounter)
      .mockImplementationOnce(() => mockSessionAccessCounter2)
    
    const session1 = sessionManager.createSession(sessionId1, mockOnTimeout1)
    const session2 = sessionManager.createSession(sessionId2, mockOnTimeout2)
    
    expect(session1).toBe(mockSessionAccessCounter)
    expect(session2).toBe(mockSessionAccessCounter2)
    
    expect(SessionAccessCounter).toHaveBeenCalledWith(1000, mockOnTimeout1)
    expect(SessionAccessCounter).toHaveBeenCalledWith(1000, mockOnTimeout2)
    
    // Delete only the first session
    sessionManager.deleteSession(sessionId1)
    
    expect(mockSessionAccessCounter.clear).toHaveBeenCalled()
    expect(mockSessionAccessCounter2.clear).not.toHaveBeenCalled()
    
    expect(sessionManager.getSession(sessionId1)).toBeUndefined()
    expect(sessionManager.getSession(sessionId2)).toBe(mockSessionAccessCounter2)
  })
})

