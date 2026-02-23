import { incomingMessageSchema } from '../../utils/ws-validation'
import { SlidingWindowRateLimiter } from '../../utils/rate-limiter'

describe('WebSocket validation + rate limit integration', () => {
  it('should validate messages and enforce per-client message rate', () => {
    const limiter = new SlidingWindowRateLimiter(1_000, 2)
    const clientId = 'integration-client'

    const msg1 = incomingMessageSchema.safeParse({
      type: 'join_session',
      sessionId: 'session-abc',
    })
    const msg2 = incomingMessageSchema.safeParse({
      type: 'interrupt',
    })
    const msg3 = incomingMessageSchema.safeParse({
      type: 'audio_stream_end',
    })

    expect(msg1.success).toBe(true)
    expect(msg2.success).toBe(true)
    expect(msg3.success).toBe(true)

    expect(limiter.allow(clientId, 10)).toBe(true)
    expect(limiter.allow(clientId, 20)).toBe(true)
    expect(limiter.allow(clientId, 30)).toBe(false)
  })
})
