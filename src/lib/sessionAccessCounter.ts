export class SessionAccessCounter {
  private accessCount = 0
  private timeoutId: NodeJS.Timeout | null = null

  constructor(
    private readonly timeout: number,
    private readonly onTimeout: () => void,
  ) {}

  inc() {
    this.accessCount++
    this.clearTimeout()
  }

  dec() {
    this.accessCount--
    if (this.accessCount === 0) {
      this.startTimeout()
    }
  }

  clear() {
    this.clearTimeout()
  }

  private startTimeout() {
    if (this.timeout > 0) {
      this.timeoutId = setTimeout(() => {
        this.onTimeout()
      }, this.timeout)
    }
  }

  private clearTimeout() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
  }
}