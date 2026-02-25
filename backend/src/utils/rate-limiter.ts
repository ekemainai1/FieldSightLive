export class SlidingWindowRateLimiter {
  private buckets: Map<string, { windowStart: number; count: number }> = new Map()

  constructor(
    private readonly windowMs: number,
    private readonly maxMessages: number,
  ) {}

  public allow(clientId: string, now = Date.now()): boolean {
    const current = this.buckets.get(clientId)
    if (!current || now - current.windowStart > this.windowMs) {
      this.buckets.set(clientId, { windowStart: now, count: 1 })
      return true
    }

    if (current.count >= this.maxMessages) {
      return false
    }

    current.count += 1
    return true
  }

  public getRemaining(clientId: string): number {
    const current = this.buckets.get(clientId)
    if (!current || Date.now() - current.windowStart > this.windowMs) {
      return this.maxMessages
    }
    return Math.max(0, this.maxMessages - current.count)
  }

  public clear(clientId: string): void {
    this.buckets.delete(clientId)
  }

  public size(): number {
    return this.buckets.size
  }

  public getLimit(): number {
    return this.maxMessages
  }

  public getWindowMs(): number {
    return this.windowMs
  }
}
