import { SessionAccessCounter } from './sessionAccessCounter.js'

export class SessionManager {
  private sessions = new Map<string, SessionAccessCounter>()

  constructor(private readonly timeout: number) {}

  createSession(sessionId: string, onTimeout: () => void) {
    const session = new SessionAccessCounter(this.timeout, onTimeout)
    this.sessions.set(sessionId, session)
    return session
  }

  getSession(sessionId: string) {
    return this.sessions.get(sessionId)
  }

  deleteSession(sessionId: string) {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.clear()
      this.sessions.delete(sessionId)
    }
  }
}
