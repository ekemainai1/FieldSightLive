'use client'

import { useState, useRef, useEffect } from 'react'
import { inspectionService, type InspectionOcrResult, type WorkflowActionEvent } from '@/services/inspection-service'
import { useAppStore } from '@/lib/store'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  toolName?: string
  timestamp: number
}

interface ToolInfo {
  name: string
  description: string
  parameters: string[]
}

export default function AgentPage() {
  const inspectionId = useAppStore((state) => state.selection.technicianId ? `${state.selection.technicianId}_${Date.now()}` : '')
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tools, setTools] = useState<ToolInfo[]>([])
  const [isConfigured, setIsConfigured] = useState(true)
  const [showTools, setShowTools] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inspectionService.getAgentTools().then((response) => {
      setIsConfigured(response.configured)
      setTools(
        (response.functions as { name: string; description: string; parameters?: { properties?: Record<string, { description: string }> } }[]).map((f) => ({
          name: f.name,
          description: f.description,
          parameters: f.parameters?.properties ? Object.keys(f.parameters.properties) : [],
        })),
      )
    }).catch(() => {
      setIsConfigured(false)
    })
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    if (!input.trim() || loading) return

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)
    setError(null)

    try {
      const history = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role, content: m.content }))

      const response = await inspectionService.executeAgentAction(input.trim(), history)

      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now()}_assistant`,
        role: response.toolName ? 'tool' : 'assistant',
        content: response.message,
        toolName: response.toolName,
        timestamp: Date.now(),
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get response')
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendMessage()
    }
  }

  return (
    <div className="p-6 space-y-6 h-[calc(100vh-8rem)] flex flex-col">
      <header className="flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">AI Assistant</h1>
            <p className="text-muted-foreground">
              Natural language workflow automation with Gemini AI
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded ${isConfigured ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {isConfigured ? 'AI Connected' : 'AI Unavailable'}
            </span>
            <button
              className="text-xs px-2 py-1 rounded border hover:bg-muted"
              onClick={() => setShowTools(!showTools)}
            >
              {showTools ? 'Hide Tools' : 'Show Tools'}
            </button>
          </div>
        </div>
      </header>

      {showTools && (
        <div className="flex-shrink-0 rounded border p-4 space-y-3 bg-muted/30">
          <h2 className="text-sm font-semibold">Available AI Tools</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {tools.map((tool) => (
              <div key={tool.name} className="rounded border p-3 text-xs">
                <p className="font-semibold text-primary">{tool.name}</p>
                <p className="text-muted-foreground mt-1">{tool.description}</p>
                {tool.parameters.length > 0 && (
                  <p className="mt-2 text-muted-foreground">
                    <span className="font-medium">Params:</span> {tool.parameters.join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 rounded border bg-card overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-lg font-medium">Welcome to AI Assistant</p>
              <p className="text-sm mt-2">
                Ask me to perform tasks like:
              </p>
              <ul className="text-sm mt-4 space-y-1">
                <li>• &quot;Log an issue: The valve is leaking&quot;</li>
                <li>• &quot;Create a ticket for inspection #123&quot;</li>
                <li>• &quot;Notify my supervisor about the safety concern&quot;</li>
                <li>• &quot;Run OCR on the latest image&quot;</li>
                <li>• &quot;Add this to history&quot;</li>
              </ul>
              <p className="text-sm mt-4">
                The AI will automatically detect the appropriate tool to use.
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : msg.role === 'tool'
                      ? 'bg-blue-50 border border-blue-200 dark:bg-blue-950 dark:border-blue-800'
                      : 'bg-muted'
                  }`}
                >
                  {msg.toolName && (
                    <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">
                      🔧 Tool: {msg.toolName}
                    </p>
                  )}
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <p className="text-xs opacity-50 mt-1">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg p-3">
                <p className="text-sm animate-pulse">Thinking...</p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="flex-shrink-0 border-t p-4">
          <div className="flex gap-2">
            <input
              className="flex-1 rounded border px-3 py-2 text-sm"
              placeholder="Ask the AI assistant to perform tasks..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading || !isConfigured}
            />
            <button
              className="px-4 py-2 rounded bg-primary text-primary-foreground text-sm disabled:opacity-50"
              onClick={() => void sendMessage()}
              disabled={loading || !isConfigured || !input.trim()}
            >
              {loading ? '...' : 'Send'}
            </button>
          </div>
          {error && <p className-destructive mt-2="text-xs text">{error}</p>}
        </div>
      </div>

      <div className="flex-shrink-0 rounded border p-3 text-xs text-muted-foreground">
        <p>
          <span className="font-medium">Tip:</span> The AI assistant understands natural language and will automatically
          select the appropriate tool. You can also provide inspection context in your requests.
        </p>
      </div>
    </div>
  )
}
