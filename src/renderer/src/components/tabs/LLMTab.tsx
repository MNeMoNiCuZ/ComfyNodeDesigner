import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type { ComfyNodeDef } from '../../types/node.types'
import type { ChatMessage } from '../../types/llm.types'
import { useProjectStore } from '../../store/projectStore'
import { useSettingsStore } from '../../store/settingsStore'
import { Button } from '../ui/button'
import { Textarea } from '../ui/textarea'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '../ui/select'
import { buildLLMSystemPrompt, generateAllFiles } from '../../../../main/generators/codeGenerator'
import { PROVIDER_LABELS, DEFAULT_MODELS } from '../../types/llm.types'
import {
  applyOperations,
  validateAndTagOperations,
  diffOperationsAgainstNode
} from '../../lib/nodeOperations'
import type { NodeInput, NodeOutput } from '../../types/node.types'
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
  Undo2,
  ChevronsDownUp,
  ChevronsUpDown
} from 'lucide-react'
import { cn } from '../../lib/utils'

interface LLMTabProps {
  node: ComfyNodeDef
}

type EditMode = 'execute' | 'fullnode'

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
// Full Code parser (simplified)
// ---------------------------------------------------------------------------

interface ParsedFullCode {
  inputs: NodeInput[]
  outputs: NodeOutput[]
  executeBody: string
}

const VALID_COMFY_TYPES_LOCAL = new Set([
  'IMAGE', 'LATENT', 'CONDITIONING', 'MODEL', 'VAE', 'CLIP', 'MASK',
  'CONTROL_NET', 'STYLE_MODEL', 'CLIP_VISION', 'CLIP_VISION_OUTPUT',
  'UPSCALE_MODEL', 'SAMPLER', 'SIGMAS', 'GUIDER', 'NOISE', 'GLIGEN',
  'AUDIO', 'INT', 'FLOAT', 'STRING', 'BOOLEAN', 'SEED', 'COMBO', '*'
])

const WIDGET_INPUT_TYPES_LOCAL = new Set(['INT', 'FLOAT', 'STRING', 'BOOLEAN', 'COMBO'])

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
    const requiredMatch = block.match(/"required"\s*:\s*\{([\s\S]*?)\}/)
    const optionalMatch = block.match(/"optional"\s*:\s*\{([\s\S]*?)\}/)

    const parseInputBlock = (content: string, required: boolean): void => {
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

        if (!VALID_COMFY_TYPES_LOCAL.has(type)) continue

        const isWidget = WIDGET_INPUT_TYPES_LOCAL.has(type)
        const input: NodeInput = {
          id: crypto.randomUUID(),
          name,
          type: type as any,
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
      if (VALID_COMFY_TYPES_LOCAL.has(t)) {
        outputs.push({
          id: crypto.randomUUID(),
          name: names[i] ?? `output_${i}`,
          type: t as any,
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
    const rawBody = funcMatch[1]
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
  const jsonBlock = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
  let raw = jsonBlock ? jsonBlock[1].trim() : null

  if (!raw) {
    // Find outermost {} block
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start !== -1 && end > start) raw = text.slice(start, end + 1)
  }

  if (!raw) return null

  // Normalize: if model returned a single op {op:...} instead of {operations:[...]}, wrap it
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && typeof parsed.op === 'string' && !parsed.operations) {
      return JSON.stringify({ operations: [parsed] })
    }
  } catch {
    // fall through and return raw — let caller handle parse error
  }

  return raw
}

// ---------------------------------------------------------------------------
// System prompt builders
// ---------------------------------------------------------------------------

function buildFunctionalityEditPrompt(node: ComfyNodeDef): string {
  const base = buildLLMSystemPrompt(node)

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

  const existingInputNames = node.inputs.map((i) => `"${i.name}"`).join(', ') || 'none'
  const existingOutputNames = node.outputs.map((o) => `"${o.name}"`).join(', ') || 'none'

  const defaultNameWarning = `
IMPORTANT: If the node has default or placeholder values (displayName is "My Custom Node", "New Node", or empty; description is empty; category is empty or "custom"), you MUST include a set_identity operation to give the node a proper name, category, and description based on what the user is asking you to build.`

  return `${base}${identityContext}${defaultNameWarning}

---

Here is the complete generated Python code for this node, for reference:

\`\`\`python
${fullCode}
\`\`\`

---

CRITICAL RULE: Do NOT use add_input for inputs already listed above. Do NOT use add_output for outputs already listed above.
If you want to modify an existing input, use update_input. If you want to modify an existing output, use update_output.
Adding an item that already exists will fail validation.

EXISTING INPUTS: ${existingInputNames}
EXISTING OUTPUTS: ${existingOutputNames}

You can modify this node by returning a JSON object with an "operations" array.

Each operation must be one of:

1. Add an input — "tooltip" is REQUIRED and must describe what the input does:
{"op": "add_input", "name": "mask", "type": "MASK", "required": true, "forceInput": true, "tooltip": "Alpha mask to blend images — white areas are fully blended"}

2. Update an existing input (by name) — include "tooltip" if changing what the input does:
{"op": "update_input", "name": "image", "updates": {"required": false, "type": "LATENT", "tooltip": "Input latent tensor to process"}}

3. Delete an input:
{"op": "delete_input", "name": "old_param"}

4. Add an output — "tooltip" is REQUIRED and must describe what the output contains:
{"op": "add_output", "name": "processed", "type": "IMAGE", "tooltip": "Processed image with mask applied"}

5. Update an existing output (by name) — include "tooltip" if changing what the output is:
{"op": "update_output", "name": "result", "updates": {"type": "LATENT", "tooltip": "Encoded latent representation"}}

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

          // Only diff against current node state when this is the active pending proposal.
          // For historical messages, always show the original operations so accepted proposals
          // don't collapse to "No new changes" after the node has been updated.
          const opsToShow = (isThisPreview && node)
            ? diffOperationsAgainstNode(node, parsed.operations)
            : parsed.operations
          const taggedOps = node
            ? validateAndTagOperations(node, opsToShow)
            : opsToShow.map((op: any) => ({ ...op, _invalid: false }))

          const validOps = taggedOps.filter((op: any) => !op._invalid)
          const invalidOps = taggedOps.filter((op: any) => op._invalid)
          const allValid = invalidOps.length === 0
          const allInvalid = validOps.length === 0

          // Group valid ops by category
          const groupDefs: Array<{ label: string; opTypes: string[] }> = [
            { label: 'Node Settings', opTypes: ['set_identity'] },
            { label: 'Inputs', opTypes: ['add_input', 'update_input', 'delete_input'] },
            { label: 'Outputs', opTypes: ['add_output', 'update_output', 'delete_output'] },
            { label: 'Advanced', opTypes: ['set_advanced'] },
            { label: 'Functionality', opTypes: ['set_code'] },
          ]

          // Map from original taggedOps index to group
          const opToGroup = new Map<number, string>()
          taggedOps.forEach((op: any, i: number) => {
            if (!op._invalid) {
              const grp = groupDefs.find((g) => g.opTypes.includes(op.op))
              if (grp) opToGroup.set(i, grp.label)
            }
          })

          function renderOpItem(op: any, i: number): JSX.Element {
            return (
              <li key={i} className={cn(
                'text-xs rounded px-1.5 py-0.5',
                op._invalid && 'bg-red-950/30 border border-red-900/40'
              )}>
                <div className="flex items-start gap-1">
                  <button
                    className="mt-0.5 shrink-0 text-slate-600 hover:text-slate-400"
                    onClick={() => toggleOpExpand(i)}
                    title={expandedOps.has(i) ? 'Collapse' : 'Expand JSON'}
                  >
                    {expandedOps.has(i) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  </button>
                  {/* Valid/invalid indicator */}
                  {op._invalid ? (
                    <span className="shrink-0 text-red-400 mt-0.5"><AlertCircle className="h-3 w-3" /></span>
                  ) : (
                    <span className="shrink-0 text-green-500 mt-0.5"><Check className="h-3 w-3" /></span>
                  )}
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
                                  <span>Update Node Settings</span>
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
                      {/* Error message for invalid op */}
                      {op._invalid && op._error && (
                        <p className="ml-7 mt-0.5 text-[10px] text-red-400">{op._error}</p>
                      )}
                      {expandedOps.has(i) && (
                        <pre className="mt-1 ml-4 bg-slate-900 rounded p-2 text-[10px] font-mono text-slate-400 overflow-x-auto whitespace-pre-wrap max-h-32 overflow-y-auto">
                          {JSON.stringify(op, null, 2)}
                        </pre>
                      )}
                    </li>
                )
          }

          const allExpanded = taggedOps.length > 0 && taggedOps.every((_: any, i: number) => expandedOps.has(i))

          return (
            <div className="space-y-2">
              {/* Status header */}
              <div className={cn(
                'flex items-center gap-2 text-xs font-medium px-2 py-1 rounded',
                allValid && 'text-green-300 bg-green-900/20',
                allInvalid && 'text-red-300 bg-red-900/20',
                !allValid && !allInvalid && 'text-amber-300 bg-amber-900/20'
              )}>
                {allValid && <Check className="h-3 w-3" />}
                {allInvalid && <AlertCircle className="h-3 w-3" />}
                {!allValid && !allInvalid && <AlertCircle className="h-3 w-3" />}
                {allValid && `${validOps.length} valid change${validOps.length !== 1 ? 's' : ''}`}
                {allInvalid && `All ${invalidOps.length} operation${invalidOps.length !== 1 ? 's' : ''} failed to validate`}
                {!allValid && !allInvalid && `${validOps.length} valid, ${invalidOps.length} failed`}
                <button
                  className="ml-auto inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                  onClick={() => {
                    if (allExpanded) {
                      setExpandedOps(new Set())
                    } else {
                      setExpandedOps(new Set(taggedOps.map((_: any, i: number) => i)))
                    }
                  }}
                  title={allExpanded ? 'Collapse all' : 'Expand all changes'}
                >
                  {allExpanded ? <ChevronsDownUp className="h-3 w-3" /> : <ChevronsUpDown className="h-3 w-3" />}
                  {allExpanded ? 'Collapse all' : 'Expand all'}
                </button>
              </div>

              <div className="text-sm text-slate-300 space-y-2">
                {groupDefs.map((grp) => {
                  const grpOps = taggedOps
                    .map((op: any, i: number) => ({ op, i }))
                    .filter(({ op, i: idx }) => !op._invalid && opToGroup.get(idx) === grp.label)
                  if (grpOps.length === 0) return null
                  return (
                    <div key={grp.label}>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                        {grp.label} — {grpOps.length} change{grpOps.length !== 1 ? 's' : ''}
                      </p>
                      <ul className="list-none space-y-1 text-slate-400">
                        {grpOps.map(({ op, i: idx }) => renderOpItem(op, idx))}
                      </ul>
                    </div>
                  )
                })}
                {invalidOps.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-red-500 mb-1">
                      Failed — {invalidOps.length} operation{invalidOps.length !== 1 ? 's' : ''}
                    </p>
                    <ul className="list-none space-y-1 text-slate-400">
                      {taggedOps
                        .map((op: any, i: number) => ({ op, i }))
                        .filter(({ op }) => op._invalid)
                        .map(({ op, i: idx }) => renderOpItem(op, idx))}
                    </ul>
                  </div>
                )}
              </div>
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

    // Parse failed — show friendly message
    return (
      <div className="space-y-2">
        <div className="flex items-start gap-1.5 text-xs text-amber-400 bg-amber-950/30 border border-amber-900/40 rounded px-2 py-1.5">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>
            The AI returned plain text instead of the expected JSON format. This can happen with weaker models. Try rephrasing your request or switch to a more capable model.
          </span>
        </div>
        <button
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300"
          onClick={() => setRawJsonOpen(!rawJsonOpen)}
        >
          {rawJsonOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          Show raw response
        </button>
        {rawJsonOpen && (
          <pre className="bg-slate-900 rounded p-3 text-xs font-mono text-slate-400 overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">
            {content}
          </pre>
        )}
      </div>
    )
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
  const { updateNode, pushLLMSnapshot, popLLMSnapshot } = useProjectStore()
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
    setPendingProposal,
    lastRejectedProposal,
    setLastRejectedProposal,
    favoriteModels
  } = useSettingsStore()

  const [editMode, setEditMode] = useState<EditMode>('execute')
  const [executeMessages, setExecuteMessages] = useState<ChatMessage[]>([])
  const [fullnodeMessages, setFullnodeMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [generating, setGenerating] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [appliedMessageIds, setAppliedMessageIds] = useState<Set<string>>(new Set())
  const [systemPromptOpen, setSystemPromptOpen] = useState(false)
  const [ollamaRunning, setOllamaRunning] = useState<Array<{ name: string; size_vram: number }>>([])
  const ollamaPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Derived — no session state needed; the last assistant msg per mode is always "latest"
  const latestExecuteId = useMemo(() => {
    const a = executeMessages.filter(m => m.role === 'assistant')
    return a.length > 0 ? a[a.length - 1].id : null
  }, [executeMessages])
  const latestFullnodeId = useMemo(() => {
    const a = fullnodeMessages.filter(m => m.role === 'assistant')
    return a.length > 0 ? a[a.length - 1].id : null
  }, [fullnodeMessages])
  const latestResponseId = { execute: latestExecuteId, fullnode: latestFullnodeId }

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

  // Poll Ollama /api/ps for VRAM usage when Ollama is the active provider
  useEffect(() => {
    if (llm.activeProvider !== 'ollama') {
      setOllamaRunning([])
      return
    }
    const baseUrl = activeConfig.baseUrl ?? 'http://localhost:11434'
    async function poll(): Promise<void> {
      try {
        const running = await window.electronAPI.fetchOllamaPs(baseUrl)
        setOllamaRunning(running)
      } catch {
        setOllamaRunning([])
      }
    }
    poll()
    ollamaPollRef.current = setInterval(poll, 5000)
    return () => {
      if (ollamaPollRef.current) clearInterval(ollamaPollRef.current)
    }
  }, [llm.activeProvider, activeConfig.baseUrl])

  const baseModelList =
    llm.activeProvider === 'ollama' ? ollamaModels : DEFAULT_MODELS[llm.activeProvider]
  const modelList = [...new Set([...baseModelList, ...(customModels[llm.activeProvider] ?? [])])]

  // Consume rejection events from NodeEditor and add to chat log
  useEffect(() => {
    if (!lastRejectedProposal || lastRejectedProposal.nodeId !== node.id) return
    const { messageId, operations, timestamp } = lastRejectedProposal
    const validOps = operations.filter((op: any) => !op._invalid)
    const lines = validOps.map((op: any) => {
      switch (op.op) {
        case 'add_input': return `• add_input: "${op.name}" (${op.type})`
        case 'update_input': return `• update_input: "${op.name}" → ${JSON.stringify(op.updates ?? {})}`
        case 'delete_input': return `• delete_input: "${op.name}"`
        case 'add_output': return `• add_output: "${op.name}" (${op.type})`
        case 'update_output': return `• update_output: "${op.name}" → ${JSON.stringify(op.updates ?? {})}`
        case 'delete_output': return `• delete_output: "${op.name}"`
        case 'set_code': return `• set_code: (new execute() body provided)`
        case 'set_identity': return `• set_identity: ${JSON.stringify(op)}`
        case 'set_advanced': return `• set_advanced: ${JSON.stringify(op)}`
        default: return `• ${op.op}`
      }
    })
    const content = validOps.length === 0
      ? `[USER REJECTED PROPOSAL]\nThe user rejected the proposal (no valid changes were pending).`
      : `[USER REJECTED PROPOSAL]\nThe user rejected the following ${validOps.length} proposed change(s):\n${lines.join('\n')}\n\nDo not repeat these exact changes unless explicitly asked.`
    const rejectionMsg: ChatMessage = {
      id: `rejection-${timestamp}`,
      role: 'rejection',
      content,
      timestamp,
      mode: 'execute'
    }
    // Add to whichever mode contains the originating message (default: execute)
    const inFullnode = fullnodeMessages.some((m) => m.id === messageId)
    if (inFullnode) {
      const msg = { ...rejectionMsg, mode: 'fullnode' as const }
      setFullnodeMessages((prev) => {
        const updated = [...prev, msg]
        setChatHistory(node.id, 'fullnode', updated)
        return updated
      })
    } else {
      setExecuteMessages((prev) => {
        const updated = [...prev, rejectionMsg]
        setChatHistory(node.id, 'execute', updated)
        return updated
      })
    }
    setLastRejectedProposal(null)
  }, [lastRejectedProposal]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Build system prompt against the effective node state — if a proposal is pending,
  // apply its ops so the LLM sees what's already been proposed, not just committed state.
  const effectiveNodeForPrompt = useMemo(() => {
    if (!pendingProposal || pendingProposal.nodeId !== node.id) return node
    const validOps = (pendingProposal.operations ?? []).filter((op: any) => !op._invalid)
    if (validOps.length === 0) return node
    const result = applyOperations(node, validOps)
    if ('error' in result) return node
    return { ...node, ...result.updates }
  }, [node, pendingProposal])

  const baseSystemPrompt =
    editMode === 'execute' ? buildFunctionalityEditPrompt(effectiveNodeForPrompt) : buildFullCodePrompt(effectiveNodeForPrompt)

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
    const allMessages = [...messages.filter((m) => m.role !== 'error' && m.role !== 'correction'), userMsg]
    const limit = Math.max(1, contextMessageCount)
    const contextMessages = contextMessageCount === 0 ? [userMsg] : allMessages.slice(-limit)
    const apiMessages = contextMessages.map((m) => ({
      role: (m.role === 'rejection' ? 'user' : m.role) as 'user' | 'assistant',
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

      // Determine response status for execute mode; diff + auto-preview
      let responseStatus: ChatMessage['responseStatus'] = 'ok'
      let autoPreviewOps: any[] | null = null
      let taggedOps: any[] | null = null
      if (currentMode === 'execute') {
        const jsonStr = extractJsonObject(result)
        if (!jsonStr) {
          responseStatus = 'parse_failed'
        } else {
          try {
            const parsed = JSON.parse(jsonStr)
            if (Array.isArray(parsed.operations)) {
              const diffed = diffOperationsAgainstNode(node, parsed.operations)
              const tagged = validateAndTagOperations(node, diffed)
              taggedOps = tagged
              const validOps = tagged.filter((op: any) => !op._invalid)
              if (tagged.length === 0 || validOps.length === 0) {
                responseStatus = 'all_invalid'
              } else {
                autoPreviewOps = tagged
              }
            } else {
              responseStatus = 'parse_failed'
            }
          } catch {
            responseStatus = 'parse_failed'
          }
        }
      }

      const assistantMsgId = generateId()
      const assistantMsg: ChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: result,
        timestamp: Date.now(),
        elapsedMs: elapsed,
        mode: currentMode,
        nodeId: currentNodeId,
        responseStatus,
        provider: llm.activeProvider,
        model: activeConfig.model
      }

      if (autoPreviewOps) {
        setPendingProposal({ nodeId: currentNodeId, messageId: assistantMsgId, operations: autoPreviewOps })
      }

      // Helper: parse + validate a retry result, return status + ops
      function parseRetryResult(raw: string): { status: ChatMessage['responseStatus']; ops: any[] | null } {
        const jsonStr = extractJsonObject(raw)
        if (!jsonStr) return { status: 'parse_failed', ops: null }
        try {
          const parsed = JSON.parse(jsonStr)
          if (!Array.isArray(parsed.operations)) return { status: 'parse_failed', ops: null }
          const diffed = diffOperationsAgainstNode(node, parsed.operations)
          const tagged = validateAndTagOperations(node, diffed)
          const validOps = tagged.filter((op: any) => !op._invalid)
          if (tagged.length === 0 || validOps.length === 0) return { status: 'all_invalid', ops: null }
          return { status: 'ok', ops: tagged }
        } catch {
          return { status: 'parse_failed', ops: null }
        }
      }

      // Helper: fire one auto-retry with a correction message
      async function fireAutoRetry(correctionText: string): Promise<void> {
        const correctionMsg: ChatMessage = {
          id: generateId(),
          role: 'correction',
          content: correctionText,
          timestamp: Date.now(),
          nodeId: currentNodeId,
          mode: currentMode
        }
        setExecuteMessages((prev) => {
          const updated = [...prev, assistantMsg, correctionMsg]
          setChatHistory(currentNodeId, 'execute', updated)
          return updated
        })

        const retryMessages = [
          ...apiMessages,
          { role: 'assistant' as const, content: result },
          { role: 'user' as const, content: correctionText }
        ]
        const retryReqId = generateId()
        requestIdRef.current = retryReqId
        const retryResult = await window.electronAPI.generateLLMChat({
          provider: llm.activeProvider,
          model: activeConfig.model,
          baseUrl: activeConfig.baseUrl,
          systemPrompt: fullSystemPrompt,
          messages: retryMessages,
          requestId: retryReqId
        })

        const retryElapsed = Date.now() - startTimeRef.current
        const { status: retryStatus, ops: retryOps } = parseRetryResult(retryResult)

        const retryMsgId = generateId()
        const retryAssistantMsg: ChatMessage = {
          id: retryMsgId,
          role: 'assistant',
          content: retryResult,
          timestamp: Date.now(),
          elapsedMs: retryElapsed,
          mode: currentMode,
          nodeId: currentNodeId,
          responseStatus: retryStatus,
          provider: llm.activeProvider,
          model: activeConfig.model
        }
        if (retryOps) {
          setPendingProposal({ nodeId: currentNodeId, messageId: retryMsgId, operations: retryOps })
        }
        setExecuteMessages((prev) => {
          const updated = [...prev, retryAssistantMsg]
          setChatHistory(currentNodeId, 'execute', updated)
          return updated
        })
      }

      // Auto-retry on parse or validation failure — once, unless we already retried.
      // For all_invalid: only retry if there are actual _invalid ops (tagged.length === 0
      // means ops were diffed away as no-ops, which is not a failure worth retrying).
      const lastUserMsg = apiMessages.filter((m) => m.role === 'user').at(-1)
      const isAlreadyRetried = lastUserMsg?.content.startsWith('[FORMAT CORRECTION]') ||
                               lastUserMsg?.content.startsWith('[VALIDATION CORRECTION]')
      const hasRealInvalidOps = (taggedOps ?? []).some((op: any) => op._invalid)

      if (currentMode === 'execute' && !isAlreadyRetried &&
          (responseStatus === 'parse_failed' || (responseStatus === 'all_invalid' && hasRealInvalidOps))) {

        let correctionText: string

        if (responseStatus === 'parse_failed') {
          const truncatedBad = result.length > 800 ? result.slice(0, 800) + '…' : result
          correctionText = `[FORMAT CORRECTION]
Your previous response was not in the required JSON format. You returned:

${truncatedBad}

You MUST respond with ONLY a valid JSON object — no markdown, no code fences, no explanation:
{"operations": [...]}

Each item must have an "op" field (add_input, update_input, delete_input, add_output, update_output, delete_output, set_code, set_identity, set_advanced).
Example: {"operations": [{"op": "set_code", "code": "        return (image,)"}]}

Re-read the original request and respond correctly now.`

        } else {
          // all_invalid — list each failing op with its error, then show actual node state
          const failureLines = (taggedOps ?? [])
            .filter((op: any) => op._invalid)
            .map((op: any, i: number) => `${i + 1}. ${op.op} "${op.name ?? ''}" → ${op._error ?? 'validation failed'}`)
            .join('\n')

          const inputList = node.inputs.map((i) => `"${i.name}" (${i.type}${i.required ? ', required' : ', optional'})`).join(', ') || '(none)'
          const outputList = node.outputs.map((o) => `"${o.name}" (${o.type})`).join(', ') || '(none)'

          correctionText = `[VALIDATION CORRECTION]
Your previous operations failed validation:

${failureLines}

Current node state — these are the EXACT names you must reference:
  Inputs:  ${inputList}
  Outputs: ${outputList}

Rules:
- update_input / delete_input → name must match an existing input exactly
- update_output / delete_output → name must match an existing output exactly
- To create a new input use add_input, new output use add_output
- Do NOT reference names that do not exist above

Re-read the original request and respond with corrected JSON now.`
        }

        try {
          await fireAutoRetry(correctionText)
        } catch (retryErr) {
          const retryErrMsg = (retryErr as Error).message ?? String(retryErr)
          if (!retryErrMsg.includes('abort') && !retryErrMsg.includes('cancel')) {
            setExecuteMessages((prev) => [...prev, {
              id: generateId(), role: 'error' as const,
              content: `Auto-retry failed: ${retryErrMsg}`,
              timestamp: Date.now(), nodeId: currentNodeId
            }])
          }
        }
      } else {
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
      pushLLMSnapshot(node.id, node)
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

      // Apply only valid ops (filter out _invalid tagged ops)
      const tagged = validateAndTagOperations(node, parsed.operations)
      const validOps = tagged.filter((op: any) => !op._invalid)

      if (validOps.length === 0) {
        setExecuteMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            role: 'error',
            content: 'Apply failed: no valid operations to apply.',
            timestamp: Date.now()
          }
        ])
        return
      }

      const result = applyOperations(node, validOps)
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

      pushLLMSnapshot(node.id, node)
      updateNode(node.id, result.updates)
    }
    setAppliedMessageIds((prev) => new Set(prev).add(msg.id))
  }

  function handleRevert(msg: ChatMessage): void {
    popLLMSnapshot(node.id)
    setAppliedMessageIds((prev) => {
      const next = new Set(prev)
      next.delete(msg.id)
      return next
    })
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
            {modelList.length > 0 ? (() => {
              const provFavs = favoriteModels[llm.activeProvider] ?? []
              const favs = modelList.filter((m) => provFavs.includes(m))
              const others = modelList.filter((m) => !provFavs.includes(m))
              return (
                <Select
                  value={activeConfig.model}
                  onValueChange={(m) => setProviderModel(llm.activeProvider, m)}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="Select model..." />
                  </SelectTrigger>
                  <SelectContent>
                    {favs.length > 0 && (
                      <SelectGroup>
                        <SelectLabel className="text-yellow-500/80">⭐ Favorites</SelectLabel>
                        {favs.map((m) => (
                          <SelectItem key={m} value={m} className="text-yellow-300">
                            {m}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                    {favs.length > 0 && others.length > 0 && <SelectSeparator />}
                    {others.length > 0 && (
                      <SelectGroup>
                        {favs.length > 0 && <SelectLabel>Others</SelectLabel>}
                        {others.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                  </SelectContent>
                </Select>
              )
            })() : llm.activeProvider === 'ollama' ? (
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
        {/* Ollama VRAM indicator — only shown for models actively using VRAM */}
        {llm.activeProvider === 'ollama' && ollamaRunning.filter((m) => m.size_vram > 0).length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
            {ollamaRunning.filter((m) => m.size_vram > 0).map((m) => (
              <span key={m.name} className="text-[10px] text-slate-500">
                <span className="text-slate-400">{m.name}</span>
                <span className="ml-1 text-emerald-600">{(m.size_vram / 1073741824).toFixed(1)} GB VRAM</span>
              </span>
            ))}
          </div>
        )}
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

        {messages.map((msg) => {
          const isLatest = msg.role === 'assistant' && msg.id === latestResponseId[msg.mode ?? 'execute']
          const isStale = msg.role === 'assistant' && !isLatest && !isAlreadyApplied(msg.id)
          return (
          <div
            key={msg.id}
            className={cn(
              'relative rounded-lg px-3 py-2 text-sm select-text',
              msg.role === 'user' && 'bg-blue-900/30 border border-blue-800/40 ml-8',
              msg.role === 'assistant' && 'bg-slate-800/50 border border-slate-700/50 mr-4',
              msg.role === 'error' && 'bg-red-900/20 border border-red-800/40',
              msg.role === 'correction' && 'bg-amber-950/40 border border-amber-800/40 ml-8',
              msg.role === 'rejection' && 'bg-red-950/40 border border-red-800/40'
            )}
          >
            {msg.role === 'error' ? (
              <p className="flex items-start gap-1.5 text-xs text-red-400 pr-5">
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
            ) : msg.role === 'correction' ? (
              <p className="flex items-start gap-1.5 text-xs text-amber-400/80">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span className="whitespace-pre-wrap">{msg.content}</span>
              </p>
            ) : msg.role === 'rejection' ? (
              <p className="flex items-start gap-1.5 text-xs text-red-400">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span className="whitespace-pre-wrap">{msg.content}</span>
              </p>
            ) : msg.role === 'user' ? (
              <p className="text-slate-200 whitespace-pre-wrap pr-5">{msg.content}</p>
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
                  {msg.mode === 'fullnode' ? (
                    isAlreadyApplied(msg.id) ? (
                      <>
                        <span className="inline-flex items-center gap-1 text-xs text-green-400 h-6 px-2">
                          <Check className="h-3 w-3" /> Applied
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 gap-1 text-xs text-slate-500 hover:text-amber-400"
                          onClick={() => handleRevert(msg)}
                          title="Revert this change"
                        >
                          <Undo2 className="h-3 w-3" />
                          Revert
                        </Button>
                      </>
                    ) : isStale ? (
                      <span className="text-xs text-slate-600 italic">Superseded by newer response</span>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 gap-1 text-xs text-slate-400 hover:text-slate-200"
                        onClick={() => handleApply(msg)}
                      >
                        Apply Full Code
                      </Button>
                    )
                  ) : null}
                  {msg.model && (
                    <span className="text-[10px] text-slate-600 ml-auto truncate max-w-[12rem]" title={msg.model}>
                      {msg.model}
                    </span>
                  )}
                  {msg.elapsedMs != null && (
                    <span className="text-[10px] text-slate-600 ml-1">
                      {(msg.elapsedMs / 1000).toFixed(1)}s
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
          )
        })}

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
