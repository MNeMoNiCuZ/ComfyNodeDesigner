import React, { useState, useEffect, useRef, useCallback } from 'react'
import type { ComfyNodeDef } from '../../types/node.types'
import type { ChatMessage } from '../../types/llm.types'
import { useProjectStore } from '../../store/projectStore'
import { useSettingsStore } from '../../store/settingsStore'
import { Button } from '../ui/button'
import { Textarea } from '../ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { buildLLMSystemPrompt } from '../../../../main/generators/codeGenerator'
import { PROVIDER_LABELS, DEFAULT_MODELS } from '../../types/llm.types'
import { Loader2, Wand2, Check, RefreshCw, AlertCircle, Send, Square, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'

interface LLMTabProps {
  node: ComfyNodeDef
}

function extractCodeBlock(text: string): string | null {
  // Try to extract a python code block first, then any code block
  const pyMatch = text.match(/```python\s*\n([\s\S]*?)```/)
  if (pyMatch) return pyMatch[1].trim()
  const anyMatch = text.match(/```\s*\n?([\s\S]*?)```/)
  if (anyMatch) return anyMatch[1].trim()
  return null
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function LLMTab({ node }: LLMTabProps): JSX.Element {
  const { updateNode } = useProjectStore()
  const {
    llm, setActiveProvider, setProviderModel, ollamaModels, ollamaFetched, fetchOllamaModels,
    customInstructions, setLLMGenerating, setActiveEditorTab
  } = useSettingsStore()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [generating, setGenerating] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [appliedMessageIds, setAppliedMessageIds] = useState<Set<string>>(new Set())
  const [systemPromptOpen, setSystemPromptOpen] = useState(false)

  const requestIdRef = useRef<string | null>(null)
  const startTimeRef = useRef<number>(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const activeConfig = llm.providers[llm.activeProvider]

  // Auto-fetch Ollama models when Ollama is selected
  useEffect(() => {
    if (llm.activeProvider === 'ollama' && !ollamaFetched) {
      fetchOllamaModels()
    }
  }, [llm.activeProvider, ollamaFetched, fetchOllamaModels])

  const modelList = llm.activeProvider === 'ollama'
    ? ollamaModels
    : DEFAULT_MODELS[llm.activeProvider]

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Elapsed timer during generation
  useEffect(() => {
    if (generating) {
      startTimeRef.current = Date.now()
      setElapsedSeconds(0)
      timerRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }, 1000)
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [generating])

  const systemPrompt = buildLLMSystemPrompt(node)
  const fullSystemPrompt = customInstructions
    ? systemPrompt + '\n\n--- Custom Instructions ---\n' + customInstructions
    : systemPrompt

  const handleSend = useCallback(async () => {
    const text = inputValue.trim()
    if (!text || generating) return

    // Check API key
    if (llm.activeProvider !== 'ollama') {
      try {
        const keyStatus = await window.electronAPI.getApiKeyStatus()
        if (!keyStatus[llm.activeProvider]) {
          const errorMsg: ChatMessage = {
            id: generateId(),
            role: 'error',
            content: `No API key configured for ${PROVIDER_LABELS[llm.activeProvider]}. Go to the Settings tab to add your API key.`,
            timestamp: Date.now()
          }
          setMessages((prev) => [...prev, errorMsg])
          return
        }
      } catch {
        // proceed anyway
      }
    }

    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: text,
      timestamp: Date.now()
    }

    setMessages((prev) => [...prev, userMsg])
    setInputValue('')
    setGenerating(true)
    setLLMGenerating(true)

    const reqId = generateId()
    requestIdRef.current = reqId

    // Build multi-turn messages for the API
    const allMessages = [...messages.filter((m) => m.role !== 'error'), userMsg]
    const apiMessages = allMessages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content
    }))

    try {
      const result = await window.electronAPI.generateLLMChat({
        provider: llm.activeProvider,
        model: activeConfig.model,
        baseUrl: activeConfig.baseUrl,
        systemPrompt: fullSystemPrompt,
        messages: apiMessages,
        requestId: reqId
      })

      const elapsed = Date.now() - startTimeRef.current
      const assistantMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: result,
        timestamp: Date.now(),
        elapsedMs: elapsed
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch (e) {
      const errMessage = (e as Error).message ?? String(e)
      const isAborted = errMessage.includes('abort') || errMessage.includes('cancel')
      const errorMsg: ChatMessage = {
        id: generateId(),
        role: 'error',
        content: isAborted ? 'Generation cancelled.' : errMessage,
        timestamp: Date.now()
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setGenerating(false)
      setLLMGenerating(false)
      requestIdRef.current = null
    }
  }, [inputValue, generating, messages, llm.activeProvider, activeConfig, fullSystemPrompt, setLLMGenerating])

  function handleCancel(): void {
    if (requestIdRef.current) {
      window.electronAPI.abortLLM(requestIdRef.current)
    }
  }

  function handleApply(msg: ChatMessage): void {
    const code = extractCodeBlock(msg.content) ?? msg.content
    updateNode(node.id, { executeBody: code })
    setAppliedMessageIds((prev) => new Set(prev).add(msg.id))
  }

  function isAlreadyApplied(msg: ChatMessage): boolean {
    const code = extractCodeBlock(msg.content) ?? msg.content
    return node.executeBody === code
  }

  return (
    <div className="flex h-full flex-col">
      {/* Compact provider/model bar */}
      <div className="border-b border-slate-700/50 bg-slate-900/30 px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <Select
              value={llm.activeProvider}
              onValueChange={(v) => setActiveProvider(v as any)}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PROVIDER_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-0">
            {modelList.length > 0 ? (
              <Select
                value={activeConfig.model}
                onValueChange={(m) => setProviderModel(llm.activeProvider, m)}
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue placeholder="Select model…" />
                </SelectTrigger>
                <SelectContent>
                  {modelList.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : llm.activeProvider === 'ollama' ? (
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs w-full"
                onClick={() => fetchOllamaModels()}
              >
                <RefreshCw className="h-3 w-3" />
                Fetch Models
              </Button>
            ) : (
              <Select
                value={activeConfig.model}
                onValueChange={(m) => setProviderModel(llm.activeProvider, m)}
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={activeConfig.model}>{activeConfig.model}</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </div>

      {/* Collapsible System Prompt */}
      <div className="border-b border-slate-700/50 bg-slate-900/20">
        <button
          className="flex items-center gap-1.5 px-4 py-1.5 text-xs text-slate-500 hover:text-slate-300 w-full text-left"
          onClick={() => setSystemPromptOpen(!systemPromptOpen)}
        >
          {systemPromptOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          System Prompt
          {customInstructions && <span className="text-blue-400 ml-1">(+ custom instructions)</span>}
        </button>
        {systemPromptOpen && (
          <div className="px-4 pb-2">
            <pre className="text-xs text-slate-500 whitespace-pre-wrap max-h-40 overflow-y-auto bg-slate-900/50 rounded p-2 font-mono">
              {fullSystemPrompt}
            </pre>
          </div>
        )}
      </div>

      {/* Chat message area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-center px-8">
            <div className="space-y-2">
              <Wand2 className="mx-auto h-8 w-8 text-slate-700" />
              <p className="text-sm text-slate-500">
                Describe what this node should do. The AI will write the <code className="font-mono">execute()</code> method body.
              </p>
              <p className="text-xs text-slate-600">
                You can iterate with follow-up messages like "add error handling" or "use numpy instead".
              </p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={cn(
            'rounded-lg px-3 py-2 text-sm',
            msg.role === 'user' && 'bg-blue-900/30 border border-blue-800/40 ml-8',
            msg.role === 'assistant' && 'bg-slate-800/50 border border-slate-700/50 mr-4',
            msg.role === 'error' && 'bg-red-900/20 border border-red-800/40'
          )}>
            {msg.role === 'error' ? (
              <p className="flex items-start gap-1.5 text-xs text-red-400">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>
                  {msg.content}
                  {msg.content.includes('Settings tab') && (
                    <button
                      className="ml-1 underline hover:text-red-300"
                      onClick={() => setActiveEditorTab('settings')}
                    >
                      Open Settings
                    </button>
                  )}
                </span>
              </p>
            ) : msg.role === 'user' ? (
              <p className="text-slate-200 whitespace-pre-wrap">{msg.content}</p>
            ) : (
              <div>
                <AssistantMessage content={msg.content} />
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-700/30">
                  <Button
                    size="sm"
                    variant="ghost"
                    className={cn(
                      'h-6 gap-1 text-xs',
                      isAlreadyApplied(msg) ? 'text-green-400' : 'text-slate-400 hover:text-slate-200'
                    )}
                    onClick={() => handleApply(msg)}
                    disabled={isAlreadyApplied(msg)}
                  >
                    {isAlreadyApplied(msg) ? (
                      <><Check className="h-3 w-3" /> Applied</>
                    ) : (
                      'Apply to Node'
                    )}
                  </Button>
                  {msg.elapsedMs != null && (
                    <span className="text-xs text-slate-600 ml-auto">
                      {(msg.elapsedMs / 1000).toFixed(1)}s
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {generating && (
          <div className="bg-slate-800/30 border border-slate-700/30 rounded-lg px-3 py-2 mr-4">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Generating… {elapsedSeconds}s
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input bar */}
      <div className="border-t border-slate-700/50 bg-slate-900/30 px-4 py-3">
        {generating ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 text-sm text-slate-400 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating… {elapsedSeconds}s
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5"
              onClick={handleCancel}
            >
              <Square className="h-3 w-3" />
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <Textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder='Describe what this node should do, e.g. "Blend two images using alpha compositing"'
              className="resize-none min-h-[2.5rem] max-h-32 text-sm flex-1"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              onInput={(e) => {
                // Auto-resize textarea
                const target = e.target as HTMLTextAreaElement
                target.style.height = 'auto'
                target.style.height = Math.min(target.scrollHeight, 128) + 'px'
              }}
            />
            <Button
              size="sm"
              className="h-9 gap-1.5"
              onClick={handleSend}
              disabled={!inputValue.trim()}
            >
              <Send className="h-3.5 w-3.5" />
              Send
            </Button>
          </div>
        )}
        <p className="text-xs text-slate-600 mt-1">Ctrl+Enter to send</p>
      </div>
    </div>
  )
}

/** Renders assistant content with code blocks styled as <pre> */
function AssistantMessage({ content }: { content: string }): JSX.Element {
  // Split content into text and code blocks
  const parts: Array<{ type: 'text' | 'code'; content: string; lang?: string }> = []
  const regex = /```(\w*)\s*\n([\s\S]*?)```/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: content.slice(lastIndex, match.index) })
    }
    parts.push({ type: 'code', content: match[2], lang: match[1] || undefined })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < content.length) {
    parts.push({ type: 'text', content: content.slice(lastIndex) })
  }

  if (parts.length === 0) {
    return <p className="text-slate-300 whitespace-pre-wrap text-sm">{content}</p>
  }

  return (
    <div className="space-y-2">
      {parts.map((part, i) =>
        part.type === 'code' ? (
          <pre
            key={i}
            className="bg-slate-900 rounded p-3 text-xs font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap"
          >
            {part.content}
          </pre>
        ) : (
          <p key={i} className="text-slate-300 whitespace-pre-wrap text-sm">
            {part.content.trim()}
          </p>
        )
      )}
    </div>
  )
}
