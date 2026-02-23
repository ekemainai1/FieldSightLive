import { incomingMessageSchema } from './ws-validation'

describe('incomingMessageSchema', () => {
  it('should accept valid audio payload', () => {
    const result = incomingMessageSchema.safeParse({
      type: 'audio',
      audio: 'Zm9vYmFyYmF6cXV4',
      mimeType: 'audio/pcm;rate=16000',
      sampleRate: 16000,
      timestamp: Date.now(),
    })

    expect(result.success).toBe(true)
  })

  it('should reject invalid payload shape', () => {
    const result = incomingMessageSchema.safeParse({
      type: 'audio',
      audio: '',
    })

    expect(result.success).toBe(false)
  })

  it('should accept valid video frame payload', () => {
    const result = incomingMessageSchema.safeParse({
      type: 'video_frame',
      frame: 'data:image/jpeg;base64,aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      timestamp: Date.now(),
    })

    expect(result.success).toBe(true)
  })

  it('should accept inspection context payload', () => {
    const result = incomingMessageSchema.safeParse({
      type: 'inspection_context',
      inspectionId: 'insp-123',
    })

    expect(result.success).toBe(true)
  })
})
