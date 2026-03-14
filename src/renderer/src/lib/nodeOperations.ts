import type { ComfyNodeDef, ComfyType, NodeInput } from '../types/node.types'

// ---------------------------------------------------------------------------
// Type sets
// ---------------------------------------------------------------------------

export const VALID_COMFY_TYPES = new Set([
  'IMAGE', 'LATENT', 'CONDITIONING', 'MODEL', 'VAE', 'CLIP', 'MASK',
  'CONTROL_NET', 'STYLE_MODEL', 'CLIP_VISION', 'CLIP_VISION_OUTPUT',
  'UPSCALE_MODEL', 'SAMPLER', 'SIGMAS', 'GUIDER', 'NOISE', 'GLIGEN',
  'AUDIO', 'INT', 'FLOAT', 'STRING', 'BOOLEAN', 'SEED', 'COMBO', '*'
])

export const WIDGET_INPUT_TYPES = new Set(['INT', 'FLOAT', 'STRING', 'BOOLEAN', 'COMBO'])

// ---------------------------------------------------------------------------
// applyOperations — applies an array of operations to a node and returns updates
// ---------------------------------------------------------------------------

export interface OperationResult {
  updates: Partial<ComfyNodeDef>
  summary: string
}

export function applyOperations(
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
        // Lenient: if input already exists, treat as update instead of error
        const existingIdx = inputs.findIndex((i) => i.name === op.name)
        if (existingIdx !== -1) {
          const updates: Partial<NodeInput> = {}
          if (op.type) updates.type = String(op.type).toUpperCase() as ComfyType
          if (op.required !== undefined) updates.required = Boolean(op.required)
          if (op.forceInput !== undefined) updates.forceInput = Boolean(op.forceInput)
          Object.assign(inputs[existingIdx], updates)
          changes.push(`~input "${op.name}" (already existed, updated)`)
          break
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
        // Lenient: if output already exists, treat as update instead of error
        const existingOutIdx = outputs.findIndex((o) => o.name === op.name)
        if (existingOutIdx !== -1) {
          if (op.type) outputs[existingOutIdx].type = String(op.type).toUpperCase() as ComfyType
          changes.push(`~output "${op.name}" (already existed, updated)`)
          break
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
// diffOperationsAgainstNode — removes ops that are already reflected in node
// ---------------------------------------------------------------------------

/**
 * Filters out operations whose effect is already present in the current node.
 * Used after multi-turn LLM responses where the model re-sends previously
 * applied ops alongside new ones.
 */
export function diffOperationsAgainstNode(node: ComfyNodeDef, operations: any[]): any[] {
  return operations.filter((op) => {
    if (!op) return false
    switch (op.op) {
      case 'add_input': {
        const existing = node.inputs.find((i) => i.name === op.name)
        if (!existing) return true // genuinely new
        // Same name + same type = already applied
        return String(op.type ?? 'IMAGE').toUpperCase() !== existing.type
      }
      case 'add_output': {
        const existing = node.outputs.find((o) => o.name === op.name)
        if (!existing) return true
        return String(op.type ?? 'IMAGE').toUpperCase() !== existing.type
      }
      case 'update_input': {
        const existing = node.inputs.find((i) => i.name === op.name)
        if (!existing) return true // will fail validation anyway
        const updates = op.updates ?? op
        if (updates.type !== undefined && String(updates.type).toUpperCase() !== existing.type) return true
        if (updates.required !== undefined && Boolean(updates.required) !== Boolean(existing.required)) return true
        if (updates.forceInput !== undefined && Boolean(updates.forceInput) !== Boolean(existing.forceInput)) return true
        if (updates.widget !== undefined) return true
        return false
      }
      case 'update_output': {
        const existing = node.outputs.find((o) => o.name === op.name)
        if (!existing) return true
        const updates = op.updates ?? op
        if (updates.type !== undefined && String(updates.type).toUpperCase() !== existing.type) return true
        if (updates.name !== undefined && updates.name !== existing.name) return true
        return false
      }
      case 'set_code': {
        if (typeof op.code !== 'string') return true
        const norm = (s: string): string => s.trim().replace(/\r\n/g, '\n')
        return norm(op.code) !== norm(node.executeBody ?? '')
      }
      case 'set_identity': {
        const fields = ['displayName', 'internalName', 'category', 'description', 'functionName', 'usePackFolder'] as const
        return fields.some((f) => op[f] !== undefined && String(op[f]) !== String((node as any)[f] ?? ''))
      }
      case 'set_advanced': {
        const fields = ['isOutputNode', 'isInputNode', 'validateInputs', 'isChangedMode'] as const
        return fields.some((f) => op[f] !== undefined && String(op[f]) !== String((node as any)[f] ?? ''))
      }
      default:
        return true
    }
  })
}

// ---------------------------------------------------------------------------
// validateAndTagOperations — returns each op tagged with _invalid / _error
// ---------------------------------------------------------------------------

export function validateAndTagOperations(
  node: ComfyNodeDef,
  operations: any[]
): any[] {
  const inputs = [...node.inputs.map((i) => ({ ...i }))]
  const outputs = [...node.outputs.map((o) => ({ ...o }))]

  return operations.map((op) => {
    const result = validateSingleOp(op, inputs, outputs)
    if (!result.valid) {
      return { ...op, _invalid: true, _error: result.error }
    }
    // Mutate local arrays so subsequent ops see the changes
    if (op.op === 'add_input') {
      inputs.push({
        id: '_',
        name: op.name,
        type: (op.type ?? 'IMAGE') as ComfyType,
        required: op.required !== false,
        forceInput: true,
        tooltip: ''
      })
    }
    if (op.op === 'add_output') {
      outputs.push({ id: '_', name: op.name, type: (op.type ?? 'IMAGE') as ComfyType, tooltip: '' })
    }
    if (op.op === 'delete_input') {
      const i = inputs.findIndex((x) => x.name === op.name)
      if (i !== -1) inputs.splice(i, 1)
    }
    if (op.op === 'delete_output') {
      const i = outputs.findIndex((x) => x.name === op.name)
      if (i !== -1) outputs.splice(i, 1)
    }
    return { ...op, _invalid: false }
  })
}

function validateSingleOp(
  op: any,
  inputs: any[],
  outputs: any[]
): { valid: boolean; error?: string } {
  if (!op || !op.op) return { valid: false, error: 'Missing "op" field' }
  switch (op.op) {
    case 'add_input':
      if (!op.name) return { valid: false, error: 'Missing "name"' }
      // Lenient: already-exists is handled as update in applyOperations, so it's valid
      if (op.type && !VALID_COMFY_TYPES.has(String(op.type).toUpperCase()))
        return { valid: false, error: `Invalid type "${op.type}"` }
      return { valid: true }
    case 'update_input':
      if (!op.name) return { valid: false, error: 'Missing "name"' }
      if (!inputs.find((i) => i.name === op.name))
        return { valid: false, error: `Input "${op.name}" not found` }
      return { valid: true }
    case 'delete_input':
      if (!op.name) return { valid: false, error: 'Missing "name"' }
      if (!inputs.find((i) => i.name === op.name))
        return { valid: false, error: `Input "${op.name}" not found` }
      return { valid: true }
    case 'add_output':
      if (!op.name) return { valid: false, error: 'Missing "name"' }
      // Lenient: already-exists is handled as update in applyOperations, so it's valid
      if (op.type && !VALID_COMFY_TYPES.has(String(op.type).toUpperCase()))
        return { valid: false, error: `Invalid type "${op.type}"` }
      return { valid: true }
    case 'update_output':
      if (!op.name) return { valid: false, error: 'Missing "name"' }
      if (!outputs.find((o) => o.name === op.name))
        return { valid: false, error: `Output "${op.name}" not found` }
      return { valid: true }
    case 'delete_output':
      if (!op.name) return { valid: false, error: 'Missing "name"' }
      if (!outputs.find((o) => o.name === op.name))
        return { valid: false, error: `Output "${op.name}" not found` }
      return { valid: true }
    case 'set_code':
      if (typeof op.code !== 'string') return { valid: false, error: 'Missing "code" string' }
      return { valid: true }
    case 'set_identity':
    case 'set_advanced':
      return { valid: true }
    default:
      return { valid: false, error: `Unknown operation type: "${op.op}"` }
  }
}
