import React, { useState, useEffect, useRef, useCallback } from 'react'
import type { ComfyNodeDef, ComfyType, NodeInput, NodeOutput } from '../../types/node.types'
import type { ChatMessage } from '../../types/llm.types'
import { useProjectStore } from '../../store/projectStore'
import { useSettingsStore } from '../../store/settingsStore'
import { Button } from '../ui/button'
import { Textarea } from '../ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { buildLLMSystemPrompt, generateAllFiles } from '../../../../main/generators/codeGenerator'
import { PROVIDER_LABELS, DEFAULT_MODELS } from '../../types/llm.types'
import {
  Loader2,
  Wand2,
  Check,
  RefreshCw,
  AlertCircle,
  Send,
  Square,
  ChevronDown,
  ChevronRight,
  Copy,
  Code2,
  Trash2,
  Eye,
  EyeOff
} from 'lucide-react'
import { cn } from '../../lib/utils'

interface LLMTabProps {
  node: ComfyNodeDef
}

type EditMode = 'execute' | 'fullnode'

const VALID_COMFY_TYPES = new Set([
  'IMAGE', 'LATENT', 'CONDITIONING', 'MODEL', 'VAE', 'CLIP', 'MASK',
  'CONTROL_NET', 'STYLE_MODEL', 'CLIP_VISION', 'CLIP_VISION_OUTPUT',
  'UPSCALE_MODEL', 'SAMPLER', 'SIGMAS', 'GUIDER', 'NOISE', 'GLIGEN',
  'AUDIO', 'INT', 'FLOAT', 'STRING', 'BOOLEAN', 'SEED', 'COMBO', '*'
])

const WIDGET_INPUT_TYPES = new Set(['INT', 'FLOAT', 'STRING', 'BOOLEAN', 'COMBO'])

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function copyToClipboard(text: string): void {
  navigator.clipboard.writeText(text).catch(() => {
    // fallback silent
  })
}

// ---------------------------------------------------------------------------
// Operations-based apply (Functionality Edit mode)
// ---------------------------------------------------------------------------

interface OperationResult {
  updates: Partial<ComfyNodeDef>
  summary: string
}

function applyOperations(
  node: ComfyNodeDef,
  operations: any[]
): OperationResult | { error: string } {
  const inputs = [...node.inputs.map((i) => ({ ...i }))]
  const outputs = [...node.outputs.map((o) => ({ ...o }))]
  let executeBody = node.executeBody
  const changes: string[] = []

  for (const op of operations) {
    if (!op || !op.op) {
      return { error: `Invalid operation: missing "op" field` }
    }

    switch (op.op) {
      case 'add_input': {
        if (!op.name || typeof op.name !== 'string') {
          return { error: `add_input: missing "name"` }
        }
        const type = String(op.type ?? 'IMAGE').toUpperCase()
        if (!VALID_COMFY_TYPES.has(type)) {
          return {
            error: `add_input "${op.name}": invalid type "${op.type}". Valid: ${[...VALID_COMFY_TYPES].join(', ')}`
          }
        }
        const isWidget = WIDGET_INPUT_TYPES.has(type)
        const forceInput = op.forceInput !== undefined ? Boolean(op.forceInput) : !isWidget
        let widget: NodeInput['widget'] | undefined
        if (op.widget && typeof op.widget === 'object') {
          widget = {}
          if (op.widget.min !== undefined) widget.min = Number(op.widget.min)
          if (op.widget.max !== undefined) widget.max = Number(op.widget.max)
          if (op.widget.step !== undefined) widget.step = Number(op.widget.step)
          if (op.widget.default !== undefined) widget.default = op.widget.default
          if (op.widget.multiline !== undefined) widget.multiline = Boolean(op.widget.multiline)
          if (Array.isArray(op.widget.comboOptions)) widget.comboOptions = op.widget.comboOptions
        }
        inputs.push({
          id: crypto.randomUUID(),
          name: op.name,
          type: type as ComfyType,
          required: op.required !== false,
          forceInput,
          widget,
          tooltip: ''
        })
        changes.push(`+input "${op.name}"`)
        break
      }

      case 'update_input': {
        if (!op.name || typeof op.name !== 'string') {
          return { error: `update_input: missing "name"` }
        }
        const idx = inputs.findIndex((i) => i.name === op.name)
        if (idx === -1) {
          return { error: `update_input: input "${op.name}" not found` }
        }
        const updates = op.updates ?? op
        if (updates.type) {
          const t = String(updates.type).toUpperCase()
          if (!VALID_COMFY_TYPES.has(t)) {
            return { error: `update_input "${op.name}": invalid type "${updates.type}"` }
          }
          inputs[idx].type = t as ComfyType
        }
        if (updates.required !== undefined) inputs[idx].required = Boolean(updates.required)
        if (updates.forceInput !== undefined) inputs[idx].forceInput = Boolean(updates.forceInput)
        if (updates.widget !== undefined) {
          if (updates.widget && typeof updates.widget === 'object') {
            const w: NodeInput['widget'] = {}
            if (updates.widget.min !== undefined) w.min = Number(updates.widget.min)
            if (updates.widget.max !== undefined) w.max = Number(updates.widget.max)
            if (updates.widget.step !== undefined) w.step = Number(updates.widget.step)
            if (updates.widget.default !== undefined) w.default = updates.widget.default
            if (updates.widget.multiline !== undefined) w.multiline = Boolean(updates.widget.multiline)
            if (Array.isArray(updates.widget.comboOptions))
              w.comboOptions = updates.widget.comboOptions
            inputs[idx].widget = w
          } else {
            inputs[idx].widget = undefined
          }
        }
        changes.push(`~input "${op.name}"`)
        break
      }

      case 'delete_input': {
        if (!op.name || typeof op.name !== 'string') {
          return { error: `delete_input: missing "name"` }
        }
        const before = inputs.length
        const filtered = inputs.filter((i) => i.name !== op.name)
        if (filtered.length === before) {
          return { error: `delete_input: input "${op.name}" not found` }
        }
        inputs.length = 0
        inputs.push(...filtered)
        changes.push(`-input "${op.name}"`)
        break
      }

      case 'add_output': {
        if (!op.name || typeof op.name !== 'string') {
          return { error: `add_output: missing "name"` }
        }
        const type = String(op.type ?? 'IMAGE').toUpperCase()
        if (!VALID_COMFY_TYPES.has(type)) {
          return {
            error: `add_output "${op.name}": invalid type "${op.type}". Valid: ${[...VALID_COMFY_TYPES].join(', ')}`
          }
        }
        outputs.push({
          id: crypto.randomUUID(),
          name: op.name,
          type: type as ComfyType,
          tooltip: ''
        })
        changes.push(`+output "${op.name}"`)
        break
      }

      case 'update_output': {
        if (!op.name || typeof op.name !== 'string') {
          return { error: `update_output: missing "name"` }
        }
        const idx = outputs.findIndex((o) => o.name === op.name)
        if (idx === -1) {
          return { error: `update_output: output "${op.name}" not found` }
        }
        const updates = op.updates ?? op
        if (updates.type) {
          const t = String(updates.type).toUpperCase()
          if (!VALID_COMFY_TYPES.has(t)) {
            return { error: `update_output "${op.name}": invalid type "${updates.type}"` }
          }
          outputs[idx].type = t as ComfyType
        }
        if (updates.name && typeof updates.name === 'string') {
          outputs[idx].name = updates.name
        }
        changes.push(`~output "${op.name}"`)
        break
      }

      case 'delete_output': {
        if (!op.name || typeof op.name !== 'string') {
          return { error: `delete_output: missing "name"` }
        }
        const before = outputs.length
        const filtered = outputs.filter((o) => o.name !== op.name)
        if (filtered.length === before) {
          return { error: `delete_output: output "${op.name}" not found` }
        }
        outputs.length = 0
        outputs.push(...filtered)
        changes.push(`-output "${op.name}"`)
        break
      }

      case 'set_code': {
        if (typeof op.code !== 'string') {
          return { error: `set_code: missing "code" string` }
        }
        executeBody = op.code
        changes.push('code')
        break
      }

      case 'set_identity': {
        // Allows updating identity fields: displayName, internalName, category, description, functionName, usePackFolder
        const identityUpdates: Partial<ComfyNodeDef> = {}
        if (typeof op.displayName === 'string') identityUpdates.displayName = op.displayName
        if (typeof op.internalName === 'string') identityUpdates.internalName = op.internalName
        if (typeof op.category === 'string') identityUpdates.category = op.category
        if (typeof op.description === 'string') identityUpdates.description = op.description
        if (typeof op.functionName === 'string') identityUpdates.functionName = op.functionName
        if (typeof op.usePackFolder === 'boolean') identityUpdates.usePackFolder = op.usePackFolder
        Object.assign(node, identityUpdates) // mutate local copy for change tracking
        changes.push(`identity(${Object.keys(identityUpdates).join(', ')})`)
        return { updates: { inputs, outputs, executeBody, ...identityUpdates }, summary: changes.join(', ') }
      }

      case 'set_advanced': {
        const advancedUpdates: Partial<ComfyNodeDef> = {}
        if (typeof op.isOutputNode === 'boolean') advancedUpdates.isOutputNode = op.isOutputNode
        if (typeof op.isInputNode === 'boolean') advancedUpdates.isInputNode = op.isInputNode
        if (typeof op.validateInputs === 'boolean') advancedUpdates.validateInputs = op.validateInputs
        if (op.isChangedMode !== undefined && ['none', 'always', 'hash'].includes(String(op.isChangedMode))) {
          advancedUpdates.isChangedMode = op.isChangedMode as 'none' | 'always' | 'hash'
        }
        changes.push(`advanced(${Object.keys(advancedUpdates).join(', ')})`)
        return { updates: { inputs, outputs, executeBody, ...advancedUpdates }, summary: changes.join(', ') }
      }

      default:
        return { error: `Unknown operation type: "${op.op}"` }
    }
  }

  return { updates: { inputs, outputs, executeBody }, summary: changes.join(', ') }
}

// ---------------------------------------------------------------------------
// Full Code parser (simplified)
// ---------------------------------------------------------------------------

interface ParsedFullCode {
  inputs: NodeInput[]
  outputs: NodeOutput[]
  executeBody: string
}

function parseFullCodeResponse(
  text: string,
  node: ComfyNodeDef
): ParsedFullCode | { error: string } {
  // Strip markdown code fences if present
  let code = text.trim()
  const pyMatch = code.match(/```(?:python)?\s*\n([\s\S]*?)```/)
  if (pyMatch) code = pyMatch[1].trim()

  // Extract INPUT_TYPES
  const inputs: NodeInput[] = []
  const inputTypesMatch = code.match(
    /def\s+INPUT_TYPES\s*\([^)]*\)\s*:\s*\n\s*return\s*\{([\s\S]*?)\n\s{4}\}/
  )
  if (inputTypesMatch) {
    const block = inputTypesMatch[1]
    // Find required and optional blocks
    const requiredMatch = block.match(/"required"\s*:\s*\{([\s\S]*?)\}/)
    const optionalMatch = block.match(/"optional"\s*:\s*\{([\s\S]*?)\}/)

    const parseInputBlock = (content: string, required: boolean): void => {
      // Match patterns like "name": ("TYPE", ...) or "name": ([options], ...)
      const inputPattern = /"(\w+)"\s*:\s*\((\[[\s\S]*?\]|"[^"]*")/g
      let m: RegExpExecArray | null
      while ((m = inputPattern.exec(content)) !== null) {
        const name = m[1]
        let type: string
        let comboOptions: string[] | undefined

        if (m[2].startsWith('[')) {
          type = 'COMBO'
          try {
            const optStr = m[2].replace(/'/g, '"')
            comboOptions = JSON.parse(optStr)
          } catch {
            comboOptions = []
          }
        } else {
          type = m[2].replace(/"/g, '').toUpperCase()
        }

        if (!VALID_COMFY_TYPES.has(type)) continue

        const isWidget = WIDGET_INPUT_TYPES.has(type)
        const input: NodeInput = {
          id: crypto.randomUUID(),
          name,
          type: type as ComfyType,
          required,
          forceInput: !isWidget,
          tooltip: ''
        }
        if (type === 'COMBO' && comboOptions) {
          input.widget = { comboOptions, default: comboOptions[0] }
          input.forceInput = false
        }
        inputs.push(input)
      }
    }

    if (requiredMatch) parseInputBlock(requiredMatch[1], true)
    if (optionalMatch) parseInputBlock(optionalMatch[1], false)
  }

  // Extract RETURN_TYPES
  const outputs: NodeOutput[] = []
  const returnTypesMatch = code.match(/RETURN_TYPES\s*=\s*\(([\s\S]*?)\)/)
  const returnNamesMatch = code.match(/RETURN_NAMES\s*=\s*\(([\s\S]*?)\)/)

  if (returnTypesMatch) {
    const types = returnTypesMatch[1].match(/"([^"]+)"/g)?.map((s) => s.replace(/"/g, '')) ?? []
    const names = returnNamesMatch
      ? returnNamesMatch[1].match(/"([^"]+)"/g)?.map((s) => s.replace(/"/g, '')) ?? []
      : []

    types.forEach((type, i) => {
      const t = type.toUpperCase()
      if (VALID_COMFY_TYPES.has(t)) {
        outputs.push({
          id: crypto.randomUUID(),
          name: names[i] ?? `output_${i}`,
          type: t as ComfyType,
          tooltip: ''
        })
      }
    })
  }

  // Extract function body
  const funcName = node.functionName || 'execute'
  const funcPattern = new RegExp(
    `def\\s+${funcName}\\s*\\(self[^)]*\\)\\s*:\\s*\\n((?:        [^\\n]*\\n?|\\s*\\n)*)`,
    'm'
  )
  const funcMatch = code.match(funcPattern)
  let executeBody = node.executeBody

  if (funcMatch) {
    // Get body lines — everything until we hit a line that's not indented with at least 8 spaces
    // or an empty line, up to the next class-level def or end of class
    const rawBody = funcMatch[1]
    // Trim trailing empty lines
    executeBody = rawBody.replace(/\s+$/, '')
    if (!executeBody.trim()) {
      executeBody = '        pass'
    }
  }

  if (inputs.length === 0 && outputs.length === 0 && executeBody === node.executeBody) {
    return { error: 'Could not parse any changes from the code. The parser could not identify inputs, outputs, or function body modifications.' }
  }

  return { inputs: inputs.length > 0 ? inputs : node.inputs, outputs: outputs.length > 0 ? outputs : node.outputs, executeBody }
}

// ---------------------------------------------------------------------------
// JSON extraction helper
// ---------------------------------------------------------------------------

function extractJsonObject(text: string): string | null {
  // Try json code block first
  const jsonBlock = text.match(/```(?:json)?\s*\n([\s\S]*?)```/)
  if (jsonBlock) return jsonBlock[1].trim()

  // Find outermost {} block
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start !== -1 && end > start) return text.slice(start, end + 1)

  return null
}

// ---------------------------------------------------------------------------
// System prompt builders
// ---------------------------------------------------------------------------

function buildFunctionalityEditPrompt(node: ComfyNodeDef): string {
  const base = buildLLMSystemPrompt(node)

  // Also generate full code for reference
  const fullCode = generateAllFiles([node], 'node').singleFilePy

  const identityContext = `
CURRENT NODE IDENTITY & SETTINGS:
  displayName: "${node.displayName}"
  internalName: "${node.internalName}"
  category: "${node.category}"
  description: "${node.description ?? ''}"
  functionName: "${node.functionName}"
  isOutputNode: ${node.isOutputNode}
  isInputNode: ${node.isInputNode}
  validateInputs: ${node.validateInputs}
  isChangedMode: "${node.isChangedMode}"
  usePackFolder: ${node.usePackFolder ?? false}`

  return `${base}${identityContext}

---

Here is the complete generated Python code for this node, for reference:

\`\`\`python
${fullCode}
\`\`\`

---

You can modify this node by returning a JSON object with an "operations" array.

Each operation must be one of:

1. Add an input:
{"op": "add_input", "name": "mask", "type": "MASK", "required": true, "forceInput": true}

2. Update an existing input (by name):
{"op": "update_input", "name": "image", "updates": {"required": false, "type": "LATENT"}}

3. Delete an input:
{"op": "delete_input", "name": "old_param"}

4. Add an output:
{"op": "add_output", "name": "processed", "type": "IMAGE"}

5. Update an existing output (by name):
{"op": "update_output", "name": "result", "updates": {"type": "LATENT"}}

6. Delete an output:
{"op": "delete_output", "name": "unused_output"}

7. Set the function code (indented with 8 spaces):
{"op": "set_code", "code": "        import torch\\n        result = image * 2\\n        return (result,)"}

8. Update identity fields (displayName, internalName, category, description, functionName, usePackFolder):
{"op": "set_identity", "displayName": "Better Node Name", "category": "image/processing"}

9. Update advanced settings:
{"op": "set_advanced", "isOutputNode": true, "isChangedMode": "always"}
   Valid isChangedMode values: "none" (default caching), "always" (re-run every time), "hash" (re-run when inputs change)

For widget inputs (INT, FLOAT, STRING, BOOLEAN, COMBO with forceInput=false), you can include widget config:
{"op": "add_input", "name": "strength", "type": "FLOAT", "required": true, "forceInput": false, "widget": {"min": 0.0, "max": 1.0, "step": 0.01, "default": 0.5}}
{"op": "add_input", "name": "mode", "type": "COMBO", "required": true, "forceInput": false, "widget": {"comboOptions": ["bilinear", "nearest", "bicubic"], "default": "bilinear"}}

Valid types: IMAGE, LATENT, CONDITIONING, MODEL, VAE, CLIP, MASK, CONTROL_NET, STYLE_MODEL, CLIP_VISION, CLIP_VISION_OUTPUT, UPSCALE_MODEL, SAMPLER, SIGMAS, GUIDER, NOISE, GLIGEN, AUDIO, INT, FLOAT, STRING, BOOLEAN, COMBO, *

RESPOND WITH ONLY VALID JSON. No markdown, no explanation, just the JSON object:
{"operations": [...]}`
}

function buildFullCodePrompt(node: ComfyNodeDef): string {
  const fullCode = generateAllFiles([node], 'node').singleFilePy

  return `You are an expert ComfyUI node developer. Below is the current Python code for a custom node.
Modify it as requested and return the COMPLETE modified Python code.

Current code:
\`\`\`python
${fullCode}
\`\`\`

Rules:
- Return ONLY the complete Python code, no explanations
- Keep the class structure intact
- Use valid ComfyUI types: IMAGE, LATENT, CONDITIONING, MODEL, VAE, CLIP, MASK, CONTROL_NET, STYLE_MODEL, CLIP_VISION, CLIP_VISION_OUTPUT, UPSCALE_MODEL, SAMPLER, SIGMAS, GUIDER, NOISE, GLIGEN, AUDIO, INT, FLOAT, STRING, BOOLEAN, COMBO, *
- Maintain proper Python indentation
- Do not wrap in markdown code fences`
}

// ---------------------------------------------------------------------------
// Operations summary for display
// ---------------------------------------------------------------------------

function summarizeOperations(operations: any[]): string {
  const parts: string[] = []
  for (const op of operations) {
    switch (op.op) {
      case 'add_input':
        parts.push(`Add input "${op.name}" (${op.type ?? '?'})`)
        break
      case 'update_input':
        parts.push(`Update input "${op.name}"`)
        break
      case 'delete_input':
        parts.push(`Delete input "${op.name}"`)
        break
      case 'add_output':
        parts.push(`Add output "${op.name}" (${op.type ?? '?'})`)
        break
      case 'update_output':
        parts.push(`Update output "${op.name}"`)
        break
      case 'delete_output':
        parts.push(`Delete output "${op.name}"`)
        break
      case 'set_code':
        parts.push('Update function code')
        break
      case 'set_identity': {
        const fields = ['displayName', 'internalName', 'category', 'description', 'functionName', 'usePackFolder']
          .filter((f) => op[f] !== undefined)
        parts.push(`Update identity (${fields.join(', ')})`)
        break
      }
      case 'set_advanced': {
        const fields = ['isOutputNode', 'isInputNode', 'validateInputs', 'isChangedMode']
          .filter((f) => op[f] !== undefined)
        parts.push(`Update advanced (${fields.join(', ')})`)
        break
      }
      default:
        parts.push(`Unknown: ${op.op}`)
    }
  }
  return parts.join(', ')
}

function buildApplyButtonLabel(content: string, mode: EditMode): string {
  if (mode === 'fullnode') return 'Apply Full Code'

  // Try to parse operations and build summary
  const jsonStr = extractJsonObject(content)
  if (!jsonStr) return 'Apply Changes'

  try {
    const parsed = JSON.parse(jsonStr)
    if (!Array.isArray(parsed.operations)) return 'Apply Changes'

    const inputOps = parsed.operations.filter(
      (o: any) => o.op === 'add_input' || o.op === 'update_input' || o.op === 'delete_input'
    ).length
    const outputOps = parsed.operations.filter(
      (o: any) => o.op === 'add_output' || o.op === 'update_output' || o.op === 'delete_output'
    ).length
    const hasCode = parsed.operations.some((o: any) => o.op === 'set_code')

    const parts: string[] = []
    if (inputOps > 0) parts.push(`${inputOps} input${inputOps > 1 ? 's' : ''}`)
    if (outputOps > 0) parts.push(`${outputOps} output${outputOps > 1 ? 's' : ''}`)
    if (hasCode) parts.push('code')

    if (parts.length > 0) return `Apply (${parts.join(' + ')})`
    return 'Apply Changes'
  } catch {
    return 'Apply Changes'
  }
}

// ---------------------------------------------------------------------------
// CopyButton component
// ---------------------------------------------------------------------------

function CopyButton({ text, className }: { text: string; className?: string }): JSX.Element {
  const [copied, setCopied] = useState(false)

  const handleCopy = (): void => {
    copyToClipboard(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      className={cn(
        'inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded',
        'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors',
        className
      )}
      onClick={handleCopy}
      title="Copy to clipboard"
    >
      {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

// ---------------------------------------------------------------------------
// AssistantMessage component
// ---------------------------------------------------------------------------

// Render old → new diff for a set of field changes
function DiffRow({ label, oldVal, newVal }: { label: string; oldVal: unknown; newVal: unknown }): JSX.Element {
  const fmt = (v: unknown): string => (v === undefined || v === null ? '—' : String(v))
  const changed = String(oldVal) !== String(newVal)
  return (
    <span className="flex items-center gap-1 flex-wrap">
      <span className="text-slate-400">{label}:</span>
      {changed ? (
        <>
          <code className="text-slate-600 line-through">{fmt(oldVal)}</code>
          <span className="text-slate-600">→</span>
          <code className="text-yellow-300">{fmt(newVal)}</code>
        </>
      ) : (
        <code className="text-slate-500">{fmt(newVal)}</code>
      )}
    </span>
  )
}

function AssistantMessage({
  content,
  mode,
  node,
  messageId,
  pendingProposal,
  onSetPendingProposal
}: {
  content: string
  mode?: EditMode
  node?: ComfyNodeDef
  messageId?: string
  pendingProposal?: { nodeId: string; messageId: string; operations: any[] } | null
  onSetPendingProposal?: (proposal: { nodeId: string; messageId: string; operations: any[] } | null) => void
}): JSX.Element {
  const [rawJsonOpen, setRawJsonOpen] = useState(false)
  const [expandedOps, setExpandedOps] = useState<Set<number>>(new Set())

  function toggleOpExpand(i: number): void {
    setExpandedOps((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  // Functionality Edit mode: parse and display operations summary with diffs
  if (mode === 'execute') {
    const jsonStr = extractJsonObject(content)
    if (jsonStr) {
      try {
        const parsed = JSON.parse(jsonStr)
        if (Array.isArray(parsed.operations)) {
          const isThisPreview = pendingProposal?.messageId === messageId
          return (
            <div className="space-y-2">
              <div className="text-sm text-slate-300">
                <p className="font-medium text-slate-200 mb-1">Proposed changes:</p>
                <ul className="list-none space-y-1 text-slate-400">
                  {parsed.operations.map((op: any, i: number) => (
                    <li key={i} className="text-xs">
                      <div className="flex items-start gap-1">
                        <button
                          className="mt-0.5 shrink-0 text-slate-600 hover:text-slate-400"
                          onClick={() => toggleOpExpand(i)}
                          title={expandedOps.has(i) ? 'Collapse' : 'Expand JSON'}
                        >
                          {expandedOps.has(i) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        </button>
                        <span className="flex-1">
                      {(() => {
                        switch (op.op) {
                          case 'add_input':
                            return (
                              <span>
                                Add input <code className="text-blue-400">"{op.name}"</code>{' '}
                                <span className="text-slate-500">({op.type ?? 'IMAGE'})</span>
                              </span>
                            )
                          case 'update_input': {
                            const existing = node?.inputs.find((inp) => inp.name === op.name)
                            const updates = op.updates ?? op
                            return (
                              <span className="flex flex-col gap-0.5 mt-0.5">
                                <span>Update input <code className="text-yellow-400">"{op.name}"</code></span>
                                {existing && (
                                  <span className="ml-3 flex flex-col gap-0.5 text-[10px]">
                                    {updates.type && <DiffRow label="type" oldVal={existing.type} newVal={updates.type} />}
                                    {updates.required !== undefined && <DiffRow label="required" oldVal={existing.required} newVal={updates.required} />}
                                    {updates.forceInput !== undefined && <DiffRow label="forceInput" oldVal={existing.forceInput} newVal={updates.forceInput} />}
                                  </span>
                                )}
                              </span>
                            )
                          }
                          case 'delete_input':
                            return (
                              <span>
                                Delete input <code className="text-red-400">"{op.name}"</code>
                              </span>
                            )
                          case 'add_output':
                            return (
                              <span>
                                Add output <code className="text-blue-400">"{op.name}"</code>{' '}
                                <span className="text-slate-500">({op.type ?? 'IMAGE'})</span>
                              </span>
                            )
                          case 'update_output': {
                            const existing = node?.outputs.find((o) => o.name === op.name)
                            const updates = op.updates ?? op
                            return (
                              <span className="flex flex-col gap-0.5 mt-0.5">
                                <span>Update output <code className="text-yellow-400">"{op.name}"</code></span>
                                {existing && updates.type && (
                                  <span className="ml-3 text-[10px]">
                                    <DiffRow label="type" oldVal={existing.type} newVal={updates.type} />
                                  </span>
                                )}
                              </span>
                            )
                          }
                          case 'delete_output':
                            return (
                              <span>
                                Delete output <code className="text-red-400">"{op.name}"</code>
                              </span>
                            )
                          case 'set_code':
                            return <span>Update function code</span>
                          case 'set_identity': {
                            const fields = ['displayName', 'internalName', 'category', 'description', 'functionName', 'usePackFolder'] as const
                            const changed = fields.filter((f) => op[f] !== undefined)
                            return (
                              <span className="flex flex-col gap-0.5 mt-0.5">
                                <span>Update identity</span>
                                <span className="ml-3 flex flex-col gap-0.5 text-[10px]">
                                  {changed.map((f) => (
                                    <DiffRow key={f} label={f} oldVal={node?.[f]} newVal={op[f]} />
                                  ))}
                                </span>
                              </span>
                            )
                          }
                          case 'set_advanced': {
                            const fields = ['isOutputNode', 'isInputNode', 'validateInputs', 'isChangedMode'] as const
                            const changed = fields.filter((f) => op[f] !== undefined)
                            return (
                              <span className="flex flex-col gap-0.5 mt-0.5">
                                <span>Update advanced settings</span>
                                <span className="ml-3 flex flex-col gap-0.5 text-[10px]">
                                  {changed.map((f) => (
                                    <DiffRow key={f} label={f} oldVal={node?.[f]} newVal={op[f]} />
                                  ))}
                                </span>
                              </span>
                            )
                          }
                          default:
                            return <span className="text-slate-600">Unknown operation: {op.op}</span>
                        }
                      })()}
                        </span>
                      </div>
                      {expandedOps.has(i) && (
                        <pre className="mt-1 ml-4 bg-slate-900 rounded p-2 text-[10px] font-mono text-slate-400 overflow-x-auto whitespace-pre-wrap max-h-32 overflow-y-auto">
                          {JSON.stringify(op, null, 2)}
                        </pre>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              {node && onSetPendingProposal && messageId && (
                <div className="flex items-center gap-2">
                  <button
                    className={cn(
                      'inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded transition-colors',
                      isThisPreview
                        ? 'text-blue-300 bg-blue-900/40 hover:bg-blue-900/60'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                    )}
                    onClick={() => {
                      if (isThisPreview) {
                        onSetPendingProposal(null)
                      } else {
                        onSetPendingProposal({ nodeId: node.id, messageId, operations: parsed.operations })
                      }
                    }}
                    title={isThisPreview ? 'Clear preview from Inputs/Outputs tabs' : 'Preview changes in Inputs/Outputs tabs'}
                  >
                    {isThisPreview ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    {isThisPreview ? 'Clear Preview' : 'Preview in Tabs'}
                  </button>
                </div>
              )}
              <div>
                <button
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300"
                  onClick={() => setRawJsonOpen(!rawJsonOpen)}
                >
                  {rawJsonOpen ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                  <Code2 className="h-3 w-3" />
                  Raw JSON
                </button>
                {rawJsonOpen && (
                  <div className="relative mt-1">
                    <pre className="bg-slate-900 rounded p-3 text-xs font-mono text-slate-400 overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {JSON.stringify(parsed, null, 2)}
                    </pre>
                    <div className="absolute top-1 right-1">
                      <CopyButton text={jsonStr} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        }
      } catch {
        // Fall through to default rendering
      }
    }
  }

  // Full Code mode: render as code block with copy
  if (mode === 'fullnode') {
    let code = content.trim()
    const pyMatch = code.match(/```(?:python)?\s*\n([\s\S]*?)```/)
    if (pyMatch) code = pyMatch[1].trim()

    return (
      <div className="relative">
        <pre className="bg-slate-900 rounded p-3 text-xs font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap max-h-80 overflow-y-auto">
          {code}
        </pre>
        <div className="absolute top-1 right-1">
          <CopyButton text={code} />
        </div>
      </div>
    )
  }

  // Default: split into text/code blocks
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
          <div key={i} className="relative">
            <pre className="bg-slate-900 rounded p-3 text-xs font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap">
              {part.content}
            </pre>
            <div className="absolute top-1 right-1">
              <CopyButton text={part.content} />
            </div>
          </div>
        ) : (
          <p key={i} className="text-slate-300 whitespace-pre-wrap text-sm">
            {part.content.trim()}
          </p>
        )
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function LLMTab({ node }: LLMTabProps): JSX.Element {
  const { updateNode, project } = useProjectStore()
  const {
    llm,
    setActiveProvider,
    setProviderModel,
    ollamaModels,
    ollamaFetched,
    fetchOllamaModels,
    getEffectiveInstructions,
    setLLMGenerating,
    setActiveEditorTab,
    customModels,
    chatHistories,
    setChatHistory,
    clearChatHistory,
    contextMessageCount,
    pendingProposal,
    setPendingProposal
  } = useSettingsStore()

  const [editMode, setEditMode] = useState<EditMode>('execute')
  const [executeMessages, setExecuteMessages] = useState<ChatMessage[]>([])
  const [fullnodeMessages, setFullnodeMessages] = useState<ChatMessage[]>([])
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
  const isLoadingRef = useRef(false)

  const activeConfig = llm.providers[llm.activeProvider]

  // Current messages based on active mode
  const messages = editMode === 'execute' ? executeMessages : fullnodeMessages
  const setMessages = editMode === 'execute' ? setExecuteMessages : setFullnodeMessages

  // Load chat history from store when node changes
  useEffect(() => {
    isLoadingRef.current = true
    const history = chatHistories[node.id]
    setExecuteMessages(history?.execute ?? [])
    setFullnodeMessages(history?.fullnode ?? [])
    setPendingProposal(null)
    const t = setTimeout(() => { isLoadingRef.current = false }, 0)
    return () => clearTimeout(t)
  }, [node.id]) // intentionally excludes chatHistories to avoid loops

  // Auto-fetch Ollama models when Ollama is selected
  useEffect(() => {
    if (llm.activeProvider === 'ollama' && !ollamaFetched) {
      fetchOllamaModels()
    }
  }, [llm.activeProvider, ollamaFetched, fetchOllamaModels])

  const baseModelList =
    llm.activeProvider === 'ollama' ? ollamaModels : DEFAULT_MODELS[llm.activeProvider]
  const modelList = [...new Set([...baseModelList, ...(customModels[llm.activeProvider] ?? [])])]

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [executeMessages, fullnodeMessages, editMode])

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

  const baseSystemPrompt =
    editMode === 'execute' ? buildFunctionalityEditPrompt(node) : buildFullCodePrompt(node)

  const effectiveInstructions = getEffectiveInstructions(
    llm.activeProvider,
    llm.providers[llm.activeProvider].model
  )
  const fullSystemPrompt = effectiveInstructions
    ? baseSystemPrompt + '\n\n--- Custom Instructions ---\n' + effectiveInstructions
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
            timestamp: Date.now(),
            nodeId: node.id
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
      timestamp: Date.now(),
      mode: editMode,
      nodeId: node.id
    }

    const currentNodeId = node.id
    const currentMode = editMode

    setMessages((prev) => {
      const updated = [...prev, userMsg]
      if (!isLoadingRef.current) {
        setChatHistory(currentNodeId, currentMode, updated)
      }
      return updated
    })
    setInputValue('')
    setGenerating(true)
    setLLMGenerating(true)

    const reqId = generateId()
    requestIdRef.current = reqId

    // Build multi-turn messages for the API with context limit
    const allMessages = [...messages.filter((m) => m.role !== 'error'), userMsg]
    const limit = Math.max(1, contextMessageCount)
    const contextMessages = contextMessageCount === 0 ? [userMsg] : allMessages.slice(-limit)
    const apiMessages = contextMessages.map((m) => ({
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
        elapsedMs: elapsed,
        mode: currentMode,
        nodeId: currentNodeId
      }

      if (currentMode === 'execute') {
        setExecuteMessages((prev) => {
          const updated = [...prev, assistantMsg]
          setChatHistory(currentNodeId, 'execute', updated)
          return updated
        })
      } else {
        setFullnodeMessages((prev) => {
          const updated = [...prev, assistantMsg]
          setChatHistory(currentNodeId, 'fullnode', updated)
          return updated
        })
      }
    } catch (e) {
      const errMessage = (e as Error).message ?? String(e)
      const isAborted = errMessage.includes('abort') || errMessage.includes('cancel')
      const errorMsg: ChatMessage = {
        id: generateId(),
        role: 'error',
        content: isAborted ? 'Generation cancelled.' : errMessage,
        timestamp: Date.now(),
        nodeId: currentNodeId
      }
      if (currentMode === 'execute') {
        setExecuteMessages((prev) => [...prev, errorMsg])
      } else {
        setFullnodeMessages((prev) => [...prev, errorMsg])
      }
    } finally {
      setGenerating(false)
      setLLMGenerating(false)
      requestIdRef.current = null
    }
  }, [
    inputValue,
    generating,
    messages,
    llm.activeProvider,
    activeConfig,
    fullSystemPrompt,
    editMode,
    setLLMGenerating,
    setMessages,
    setChatHistory,
    contextMessageCount,
    node.id
  ])

  function handleCancel(): void {
    if (requestIdRef.current) {
      window.electronAPI.abortLLM(requestIdRef.current)
    }
  }

  function handleApply(msg: ChatMessage): void {
    // Guard: don't apply a response that was generated for a different node
    if (msg.nodeId && msg.nodeId !== node.id) {
      const setter = msg.mode === 'fullnode' ? setFullnodeMessages : setExecuteMessages
      setter((prev) => [
        ...prev,
        {
          id: generateId(),
          role: 'error' as const,
          content: `Warning: this response was generated for a different node. Switch back to that node before applying.`,
          timestamp: Date.now()
        }
      ])
      return
    }
    if (msg.mode === 'fullnode') {
      const result = parseFullCodeResponse(msg.content, node)
      if ('error' in result) {
        const setter = msg.mode === 'fullnode' ? setFullnodeMessages : setExecuteMessages
        setter((prev) => [
          ...prev,
          {
            id: generateId(),
            role: 'error',
            content: `Apply failed: ${result.error}`,
            timestamp: Date.now()
          }
        ])
        return
      }
      updateNode(node.id, {
        inputs: result.inputs,
        outputs: result.outputs,
        executeBody: result.executeBody
      })
    } else {
      // Functionality Edit: parse operations JSON
      const jsonStr = extractJsonObject(msg.content)
      if (!jsonStr) {
        setExecuteMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            role: 'error',
            content: 'Apply failed: could not find JSON in response.',
            timestamp: Date.now()
          }
        ])
        return
      }

      let parsed: any
      try {
        parsed = JSON.parse(jsonStr)
      } catch (e) {
        setExecuteMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            role: 'error',
            content: `Apply failed: invalid JSON - ${(e as Error).message}`,
            timestamp: Date.now()
          }
        ])
        return
      }

      if (!Array.isArray(parsed.operations)) {
        setExecuteMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            role: 'error',
            content: 'Apply failed: response missing "operations" array.',
            timestamp: Date.now()
          }
        ])
        return
      }

      const result = applyOperations(node, parsed.operations)
      if ('error' in result) {
        setExecuteMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            role: 'error',
            content: `Apply failed: ${result.error}`,
            timestamp: Date.now()
          }
        ])
        return
      }

      updateNode(node.id, result.updates)
    }
    setAppliedMessageIds((prev) => new Set(prev).add(msg.id))
  }

  function isAlreadyApplied(msgId: string): boolean {
    return appliedMessageIds.has(msgId)
  }

  const emptyStateText =
    editMode === 'execute'
      ? {
          main: 'Describe what changes you want to make. The AI will return operations to modify inputs, outputs, and function code.',
          hint: 'Iterate with follow-up messages like "add a mask input" or "change the output type to LATENT".'
        }
      : {
          main: 'Describe the changes you want. The AI will return the complete modified Python code.',
          hint: 'The AI will rewrite the entire node. Review the code before applying.'
        }

  const sendPlaceholder =
    editMode === 'execute'
      ? 'Describe changes, e.g. "Add a mask input and blend two images using alpha compositing"'
      : 'Describe changes, e.g. "Add a strength float slider and use it to control the blend"'

  return (
    <div className="flex h-full flex-col">
      {/* Provider / Model bar */}
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
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
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
                  <SelectValue placeholder="Select model..." />
                </SelectTrigger>
                <SelectContent>
                  {modelList.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
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
          {/* Clear history button */}
          <button
            onClick={() => {
              clearChatHistory(node.id)
              setExecuteMessages([])
              setFullnodeMessages([])
              setPendingProposal(null)
            }}
            className="shrink-0 rounded p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-700/60 transition-colors"
            title="Clear chat history for this node"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Sub-tab selector */}
      <div className="border-b border-slate-700/50 bg-slate-900/20 px-4 py-1.5 flex items-center gap-1">
        <button
          className={cn(
            'px-3 py-1 rounded text-xs font-medium transition-colors',
            editMode === 'execute'
              ? 'bg-blue-600/80 text-white'
              : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-700/60'
          )}
          onClick={() => setEditMode('execute')}
        >
          Functionality Edit
        </button>
        <button
          className={cn(
            'px-3 py-1 rounded text-xs font-medium transition-colors',
            editMode === 'fullnode'
              ? 'bg-blue-600/80 text-white'
              : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-700/60'
          )}
          onClick={() => setEditMode('fullnode')}
        >
          Full Code
        </button>
        {editMode === 'fullnode' && (
          <span className="text-[10px] text-amber-500/80 ml-2">
            AI returns complete Python code. Review before applying.
          </span>
        )}
      </div>

      {/* Collapsible System Prompt */}
      <div className="border-b border-slate-700/50 bg-slate-900/20">
        <button
          className="flex items-center gap-1.5 px-4 py-1.5 text-xs text-slate-500 hover:text-slate-300 w-full text-left"
          onClick={() => setSystemPromptOpen(!systemPromptOpen)}
        >
          {systemPromptOpen ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          System Prompt
          {effectiveInstructions && (
            <span className="text-blue-400 ml-1">(+ custom instructions)</span>
          )}
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
          <div
            key={msg.id}
            className={cn(
              'rounded-lg px-3 py-2 text-sm',
              msg.role === 'user' && 'bg-blue-900/30 border border-blue-800/40 ml-8',
              msg.role === 'assistant' && 'bg-slate-800/50 border border-slate-700/50 mr-4',
              msg.role === 'error' && 'bg-red-900/20 border border-red-800/40'
            )}
          >
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
                <AssistantMessage
                  content={msg.content}
                  mode={msg.mode}
                  node={node}
                  messageId={msg.id}
                  pendingProposal={pendingProposal}
                  onSetPendingProposal={setPendingProposal}
                />
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-700/30">
                  <Button
                    size="sm"
                    variant="ghost"
                    className={cn(
                      'h-6 gap-1 text-xs',
                      isAlreadyApplied(msg.id)
                        ? 'text-green-400'
                        : 'text-slate-400 hover:text-slate-200'
                    )}
                    onClick={() => handleApply(msg)}
                    disabled={isAlreadyApplied(msg.id)}
                  >
                    {isAlreadyApplied(msg.id) ? (
                      <>
                        <Check className="h-3 w-3" /> Applied
                      </>
                    ) : (
                      buildApplyButtonLabel(msg.content, msg.mode ?? editMode)
                    )}
                  </Button>
                  <CopyButton text={msg.content} className="ml-1" />
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
              Generating... {elapsedSeconds}s
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
              Generating... {elapsedSeconds}s
            </div>
            <Button variant="destructive" size="sm" className="gap-1.5" onClick={handleCancel}>
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
