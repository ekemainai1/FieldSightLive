import { z } from 'zod'

const joinSessionSchema = z.object({
  type: z.literal('join_session'),
  sessionId: z.string().min(1).max(128),
})

const videoFrameSchema = z.object({
  type: z.literal('video_frame'),
  frame: z.string().min(32),
  timestamp: z.number().int().nonnegative(),
})

const audioSchema = z.object({
  type: z.literal('audio'),
  audio: z.string().min(16),
  mimeType: z.string().optional(),
  sampleRate: z.number().int().positive().optional(),
  transcript: z.string().optional(),
  timestamp: z.number().int().nonnegative().optional(),
})

const audioStreamEndSchema = z.object({
  type: z.literal('audio_stream_end'),
  timestamp: z.number().int().nonnegative().optional(),
})

const interruptSchema = z.object({
  type: z.literal('interrupt'),
})

const inspectionContextSchema = z.object({
  type: z.literal('inspection_context'),
  inspectionId: z.string().min(1).max(128),
})

export const incomingMessageSchema = z.discriminatedUnion('type', [
  joinSessionSchema,
  videoFrameSchema,
  audioSchema,
  audioStreamEndSchema,
  interruptSchema,
  inspectionContextSchema,
])

export type IncomingMessage = z.infer<typeof incomingMessageSchema>
