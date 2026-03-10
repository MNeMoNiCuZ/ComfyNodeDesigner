import React, { useState, useEffect, useRef, useCallback } from 'react'
import type { ComfyNodeDef, ComfyType, NodeInput, NodeOutput } from '../../types/node.types'
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

type EditMode = 'execute' | 'fullnode'

const VALID_COMFY_TYPES = new Set([
  'IMAGE', 'LATENT', 'CONDITIONING', 'MODEL', 'VAE', 'CLIP', 'MASK',
  'CONTROL_NET', 'STYLE_MODEL', 'CLIP_VISION', 'CLIP_VISION_OUTPUT',
  'UPSCALE_MODEL', 'SAMPLER', 'SIGMAS', 'GUIDER', 'NOISE', 'GLIGEN',
  'AUDIO', 'INT', 'FLOAT', 'STRING', 'BOOLEAN', 'COMBO', '*'
])

const WIDGET_INPUT_TYPES = new Set(['INT', 'FLOAT', 'STRING', 'BOOLEAN', 'COMBO'])

function extractCodeBlock(text: string): string | null {
  const pyMatch = text.match(/```python\s*\n([\s\S]*?)```/)
  if (pyMatch) return pyMatch[1].trim()
  const anyMatch = text.match(/```\s*\n?([\s\S]*?)```/)
  if (anyMatch) return anyMatch[1].trim()
  return null
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function buildFullNodeSystemPrompt(node: ComfyNodeDef): string {
  const inputsSummary = node.inputs.map((i) => ({
    name: i.name,
    type: i.type,
    required: i.required,
    forceInput: i.forceInput ?? false
  }))
  const outputsSummary = node.outputs.map((o) => ({ name: o.name, type: o.type }))

  return `You are an expert ComfyUI custom node developer. The user wants to redesign a node's inputs, outputs, and execute() method body.

Current node state:
- Internal name: ${node.internalName}
- Display name: ${node.displayName}
- Category: ${node.category}

Current inputs: ${JSON.stringify(inputsSummary, null, 2)}

Current outputs: ${JSON.stringify(outputsSummary, null, 2)}

Current execute() body:
\`\`\`python
${node.executeBody}
\`\`\`

VALID ComfyUI types (use EXACTLY these strings, case-sensitive):
IMAGE, LATENT, CONDITIONING, MODEL, VAE, CLIP, MASK, CONTROL_NET, STYLE_MODEL, CLIP_VISION, CLIP_VISION_OUTPUT, UPSCALE_MODEL, SAMPLER, SIGMAS, GUIDER, NOISE, GLIGEN, AUDIO, INT, FLOAT, STRING, BOOLEAN, COMBO, *

You MUST respond with ONLY valid JSON — no explanation, no markdown, no prose. Use this exact schema:
{
  "inputs": [
    {
      "name": "image",
      "type": "IMAGE",
      "required": true,
      "forceInput": true,
      "widget": null
    }
  ],
  "outputs": [
    {
      "name": "image",
      "type": "IMAGE"
    }
  ],
  "executeBody": "        # your Python code here\\n        return (image,)"
}

Widget object format (only for INT/FLOAT/STRING/BOOLEAN/COMBO with forceInput=false):
{ "min": 0, "max": 100, "step": 1, "default": 50, "multiline": false, "comboOptions": ["opt1", "opt2"] }
Set widget to null for socket types (IMAGE, LATENT, MODEL, etc.).

Rules:
- executeBody is ONLY the indented function body lines, NOT the def line
- Use 8-space indentation for executeBody
- Socket-type inputs (IMAGE, LATENT, MODEL, VAE, etc.) must have forceInput: true, widget: null
- Widget inputs (INT, FLOAT, STRING, BOOLEAN, COMBO) typically have forceInput: false
- The return statement in executeBody must match the number and types of outputs`
}

interface ParsedFullNode {
  inputs: NodeInput[]
  outputs: NodeOutput[]
  executeBody: string
}

function parseFullNodeResponse(text: string): ParsedFullNode | { error: string } {
  // Try to extract from json code block first, then bare JSON object
  let jsonStr = text
  const jsonBlock = text.match(/```(?:json)?\s*\n([\s\S]*?)```/)
  if (jsonBlock) {
    jsonStr = jsonBlock[1]
  } else {
    // Find outermost {} block
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start !== -1 && end > start) jsonStr = text.slice(start, end + 1)
  }

  let parsed: any
  try {
    parsed = JSON.parse(jsonStr.trim())
  } catch (e) {
    return { error: `Could not parse JSON from response: ${(e as Error).message}` }
  }

  if (!Array.isArray(parsed.inputs)) return { error: 'Response missing "inputs" array' }
  if (!Array.isArray(parsed.outputs)) return { error: 'Response missing "outputs" array' }
  if (typeof parsed.executeBody !== 'string') return { error: 'Response missing "executeBody" string' }

  const inputs: NodeInput[] = []
  for (const inp of parsed.inputs) {
    if (!inp.name || typeof inp.name !== 'string') {
      return { error: 'An input entry is missing a "name" field' }
    }
    const type = String(inp.type ?? '').toUpperCase()
    if (!VALID_COMFY_TYPES.has(type)) {
      return { error: `Invalid type "${inp.type}" for input "${inp.name}". Must be one of: ${[...VALID_COMFY_TYPES].join(', ')}` }
    }
    const isWidget = WIDGET_INPUT_TYPES.has(type)
    const forceInput = inp.forceInput !== undefined ? Boolean(inp.forceInput) : !isWidget
    let widget: NodeInput['widget'] | undefined
    if (inp.widget && typeof inp.widget === 'object') {
      widget = {}
      if (inp.widget.min !== undefined) widget.min = Number(inp.widget.min)
      if (inp.widget.max !== undefined) widget.max = Number(inp.widget.max)
      if (inp.widget.step !== undefined) widget.step = Number(inp.widget.step)
      if (inp.widget.default !== undefined) widget.default = inp.widget.default
      if (inp.widget.multiline !== undefined) widget.multiline = Boolean(inp.widget.multiline)
      if (Array.isArray(inp.widget.comboOptions)) widget.comboOptions = inp.widget.comboOptions
    }
    inputs.push({
      id: crypto.randomUUID(),
      name: inp.name,
      type: type as ComfyType,
      required: inp.required !== false,
      forceInput,
      widget,
      tooltip: ''
    })
  }

  const outputs: NodeOutput[] = []
  for (const out of parsed.outputs) {
    if (!out.name || typeof out.name !== 'string') {
      return { error: 'An output entry is missing a "name" field' }
    }
    const type = String(out.type ?? '').toUpperCase()
    if (!VALID_COMFY_TYPES.has(type)) {
      return { error: `Invalid type "${out.type}" for output "${out.name}". Must be one of: ${[...VALID_COMFY_TYPES].join(', ')}` }
    }
    outputs.push({
      id: crypto.randomUUID(),
      name: out.name,
      type: type as ComfyType,
      tooltip: ''
    })
  }

  return { inputs, outputs, executeBody: parsed.executeBody }
}

export function LLMTab({ node }: LLMTabProps): JSX.Element {
  const { updateNode } = useProjectStore()
  const {
    llm, setActiveProvider, setProviderModel, ollamaModels, ollamaFetched, fetchOllamaModels,
    customInstructions, setLLMGenerating, setActiveEditorTab
  } = useSettingsStore()

  const [editMode, setEditMode] = useState<EditMode>('execute')
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

  const baseSystemPrompt = editMode === 'execute'
    ? buildLLMSystemPrompt(node)
    : buildFullNodeSystemPrompt(node)

  const fullSystemPrompt = customInstructions
    ? baseSystemPrompt + '\n\n--- Custom Instructions ---\n' + customInstructions
    : baseSystemPrompt

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

    const currentMode = editMode

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
        elapsedMs: elapsed,
        mode: currentMode
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
  }, [inputValue, generating, messages, llm.activeProvider, activeConfig, fullSystemPrompt, editMode, setLLMGenerating])

  function handleCancel(): void {
    if (requestIdRef.current) {
      window.electronAPI.abortLLM(requestIdRef.current)
    }
  }

  function handleApply(msg: ChatMessage): void {
    if (msg.mode === 'fullnode') {
      const result = parseFullNodeResponse(msg.content)
      if ('error' in result) {
        setMessages((prev) => [
          ...prev,
          { id: generateId(), role: 'error', content: `Apply failed: ${result.error}`, timestamp: Date.now() }
        ])
        return
      }
      updateNode(node.id, { inputs: result.inputs, outputs: result.outputs, executeBody: result.executeBody })
    } else {
      const code = extractCodeBlock(msg.content) ?? msg.content
      updateNode(node.id, { executeBody: code })
    }
    setAppliedMessageIds((prev) => new Set(prev).add(msg.id))
  }

  function isAlreadyApplied(msg: ChatMessage): boolean {
    if (appliedMessageIds.has(msg.id)) return true
    if (msg.mode === 'fullnode') return false
    const code = extractCodeBlock(msg.content) ?? msg.content
    return node.executeBody === code
  }

  const emptyStateText = editMode === 'execute'
    ? { main: 'Describe what this node should do. The AI will write the execute() method body.', hint: 'Iterate with follow-up messages like "add error handling" or "use numpy instead".' }
    : { main: 'Describe the inputs, outputs, and logic you want. The AI will redesign the full node.', hint: 'The AI will return JSON with inputs, outputs, and execute body. Review before applying.' }

  const sendPlaceholder = editMode === 'execute'
    ? 'Describe what this node should do, e.g. "Blend two images using alpha compositing"'
    : 'Describe the changes, e.g. "Add a mask input and a strength float slider, output a blended image"'

  return (
    <div className="flex h-full flex-col">
      {/* Compact provider/model/mode bar */}
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
          {/* Mode selector */}
          <div className="shrink-0">
            <Select value={editMode} onValueChange={(v) => setEditMode(v as EditMode)}>
              <SelectTrigger className="h-7 text-xs w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="execute">Execute Body</SelectItem>
                <SelectItem value="fullnode">Full Node Edit</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {editMode === 'fullnode' && (
          <p className="text-[10px] text-amber-500/80 mt-1.5">
            Full Node Edit: AI will suggest new inputs, outputs, and code as JSON. Review carefully before applying.
          </p>
        )}
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
              <p className="text-sm text-slate-500">{emptyStateText.main}</p>
              <p className="text-xs text-slate-600">{emptyStateText.hint}</p>
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
                <AssistantMessage content={msg.content} mode={msg.mode} />
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
                    ) : msg.mode === 'fullnode' ? (
                      'Apply (Inputs + Outputs + Code)'
                    ) : (
                      'Apply to Node'
                    )}
                  </Button>
                  {msg.elapsedMs != null && (
                    <span className="text-xs text-slate-600 ml-auto">
                      {(msg.elapsedMs / 1000).toFixed(1)}s
                    </span>
                  )}
                  {msg.mode === 'fullnode' && !isAlreadyApplied(msg) && (
                    <span className="text-[10px] text-amber-500/70 ml-1">Full Node</span>
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
              placeholder={sendPlaceholder}
              className="resize-none min-h-[2.5rem] max-h-32 text-sm flex-1"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              onInput={(e) => {
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
function AssistantMessage({ content, mode }: { content: string; mode?: string }): JSX.Element {
  // In fullnode mode, render as a JSON code block if it looks like JSON
  if (mode === 'fullnode') {
    const jsonStart = content.indexOf('{')
    const jsonEnd = content.lastIndexOf('}')
    if (jsonStart !== -1 && jsonEnd > jsonStart) {
      const before = content.slice(0, jsonStart).trim()
      const jsonPart = content.slice(jsonStart, jsonEnd + 1)
      const after = content.slice(jsonEnd + 1).trim()
      return (
        <div className="space-y-2">
          {before && <p className="text-slate-300 whitespace-pre-wrap text-sm">{before}</p>}
          <pre className="bg-slate-900 rounded p-3 text-xs font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto">
            {jsonPart}
          </pre>
          {after && <p className="text-slate-300 whitespace-pre-wrap text-sm">{after}</p>}
        </div>
      )
    }
  }

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
