'use client'

import { useEffect, useRef } from 'react'
import { 
  AlertTriangle, 
  AlertOctagon, 
  AlertCircle, 
  CheckCircle2, 
  XCircle,
  User,
  Bot,
  Settings2,
  MessageSquare
} from 'lucide-react'
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

type WorkflowConfirmationStatus = 'pending' | 'confirmed' | 'cancelled' | 'expired'

interface ParsedWorkflowConfirmation {
  status: WorkflowConfirmationStatus
  action: string
  label: string
}

function parseWorkflowConfirmation(text: string): ParsedWorkflowConfirmation | null {
  if (!text.startsWith('WF_CONFIRM|')) return null
  const parts = text.split('|')
  if (parts.length < 4) return null
  const rawStatus = parts[1]
  if (!['pending', 'confirmed', 'cancelled', 'expired'].includes(rawStatus)) return null
  return {
    status: rawStatus as WorkflowConfirmationStatus,
    action: parts[2] || 'workflow_action',
    label: parts.slice(3).join('|') || `Voice confirmation ${rawStatus}`,
  }
}

function getWorkflowIcon(status: WorkflowConfirmationStatus) {
  switch (status) {
    case 'pending': return <AlertCircle className="w-4 h-4 text-amber-500" />
    case 'confirmed': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />
    case 'cancelled': return <XCircle className="w-4 h-4 text-slate-400" />
    case 'expired': return <AlertOctagon className="w-4 h-4 text-rose-500" />
  }
}

function getSeverityColor(severity: string) {
  switch (severity) {
    case 'critical': return 'bg-red-500 text-white border-red-600'
    case 'high': return 'bg-orange-500 text-white border-orange-600'
    case 'medium': return 'bg-amber-500 text-white border-amber-600'
    case 'low': return 'bg-yellow-400 text-amber-900 border-yellow-500'
    default: return 'bg-slate-500 text-white border-slate-600'
  }
}

function formatTimeClient(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString()
}

export function Transcript({ messages, safetyFlags, detectedFaults }: TranscriptProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  return (
    <div className="card-elevated p-0 flex flex-col h-[500px] lg:h-[600px] overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h2 className="font-semibold text-sm">Transcript</h2>
        </div>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {messages.length} message{messages.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Safety Flags */}
      {(safetyFlags.length > 0 || detectedFaults.length > 0) && (
        <div className="p-4 space-y-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          {safetyFlags.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-red-600 dark:text-red-400">
                <AlertTriangle className="w-4 h-4" />
                Safety Warnings
              </div>
              {safetyFlags.map((flag, i) => (
                <div key={i} className="flex items-start gap-2 p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-red-100 dark:border-red-900/30">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getSeverityColor(flag.severity)}`}>
                    {flag.severity.toUpperCase()}
                  </span>
                  <p className="text-xs flex-1 text-slate-700 dark:text-slate-300">{flag.description}</p>
                </div>
              ))}
            </div>
          )}

          {detectedFaults.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-orange-600 dark:text-orange-400">
                <AlertOctagon className="w-4 h-4" />
                Detected Faults
              </div>
              {detectedFaults.map((fault, i) => (
                <div key={i} className="flex items-start gap-2 p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-orange-100 dark:border-orange-900/30">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{fault.component}</span>
                      <span className="text-xs text-slate-400">- {fault.faultType}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{fault.description}</p>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
                    {Math.round(fault.confidence * 100)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center mb-4">
              <Bot className="w-8 h-8 text-blue-500" />
            </div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Ready to assist</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Start the camera and press push-to-talk to begin
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const workflow = parseWorkflowConfirmation(msg.text)
            if (workflow) {
              return (
                <div key={msg.id} className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2 mb-2">
                      {getWorkflowIcon(workflow.status)}
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                        {workflow.status}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{workflow.action}</p>
                    <p className="text-xs text-slate-500 mt-1">{workflow.label}</p>
                    <p className="text-[10px] text-slate-400 mt-2">{formatTimeClient(msg.timestamp)}</p>
                  </div>
                </div>
              )
            }

            return (
              <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  msg.type === 'user'
                    ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25'
                    : msg.type === 'system'
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    {msg.type === 'user' ? (
                      <User className="w-3.5 h-3.5 text-blue-200" />
                    ) : msg.type === 'system' ? (
                      <Settings2 className="w-3.5 h-3.5" />
                    ) : (
                      <Bot className="w-3.5 h-3.5 text-blue-500" />
                    )}
                    <span className="text-[10px] font-medium uppercase tracking-wide opacity-70">
                      {msg.type === 'user' ? 'You' : msg.type === 'system' ? 'System' : 'AI'}
                    </span>
                  </div>
                  <p className="text-sm">{msg.text}</p>
                  <p className={`text-[10px] mt-1.5 ${msg.type === 'user' ? 'text-blue-200' : 'text-slate-400'}`}>
                    {formatTimeClient(msg.timestamp)}
                  </p>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
