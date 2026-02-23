'use client'

import type { SafetyFlag, DetectedFault } from '@/services/websocket'

interface TranscriptMessage {
  id: string
  type: 'user' | 'agent' | 'system'
  text: string
  timestamp: number
}

interface TranscriptProps {
  messages: TranscriptMessage[]
  safetyFlags: SafetyFlag[]
  detectedFaults: DetectedFault[]
}

function formatTimeClient(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString()
}

export function Transcript({ messages, safetyFlags, detectedFaults }: TranscriptProps) {
  return (
    <div className="flex flex-col gap-4 h-[400px]">
      {safetyFlags.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/50 rounded-lg p-3">
          <h4 className="font-semibold text-destructive text-sm mb-2">Safety Warnings</h4>
          <div className="space-y-2">
            {safetyFlags.map((flag, i) => (
              <div key={i} className="text-sm">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  flag.severity === 'critical' ? 'bg-red-600 text-white' :
                  flag.severity === 'high' ? 'bg-orange-500 text-white' :
                  'bg-yellow-500 text-black'
                }`}>
                  {flag.severity.toUpperCase()}
                </span>
                <span className="ml-2">{flag.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {detectedFaults.length > 0 && (
        <div className="bg-orange-500/10 border border-orange-500/50 rounded-lg p-3">
          <h4 className="font-semibold text-orange-600 text-sm mb-2">Detected Faults</h4>
          <div className="space-y-2">
            {detectedFaults.map((fault, i) => (
              <div key={i} className="text-sm">
                <span className="font-medium">{fault.component}</span>
                <span className="ml-2 text-muted-foreground">- {fault.faultType}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  ({Math.round(fault.confidence * 100)}% confidence)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-3 bg-muted/30 rounded-lg p-4">
        {messages.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Start talking to begin the inspection...
          </p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  msg.type === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : msg.type === 'system'
                    ? 'bg-muted text-muted-foreground text-sm'
                    : 'bg-secondary text-secondary-foreground'
                }`}
              >
                <p className="text-sm">{msg.text}</p>
                <span className="text-xs opacity-50">
                  {formatTimeClient(msg.timestamp)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
