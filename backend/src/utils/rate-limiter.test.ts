import { SlidingWindowRateLimiter } from './rate-limiter'

describe('SlidingWindowRateLimiter', () => {
  it('should allow within limit and block above limit', () => {
    const limiter = new SlidingWindowRateLimiter(10_000, 3)
    const clientId = 'client-1'
    const now = 1_000

    expect(limiter.allow(clientId, now)).toBe(true)
    expect(limiter.allow(clientId, now + 1)).toBe(true)
    expect(limiter.allow(clientId, now + 2)).toBe(true)
    expect(limiter.allow(clientId, now + 3)).toBe(false)
  })

  it('should reset after window passes', () => {
    const limiter = new SlidingWindowRateLimiter(10_000, 2)
    const clientId = 'client-2'

    expect(limiter.allow(clientId, 0)).toBe(true)
    expect(limiter.allow(clientId, 100)).toBe(true)
    expect(limiter.allow(clientId, 200)).toBe(false)

    expect(limiter.allow(clientId, 10_100)).toBe(true)
  })
})
