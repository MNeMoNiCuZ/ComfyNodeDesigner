/**
 * Parse a full generated ComfyUI node Python file and extract structured node data.
 * This is the canonical parser used by both the Code tab (manual edits) and the
 * LLM Full Node mode — the Python file is always the source of truth.
 */
import type { ComfyNodeDef, NodeInput, NodeOutput, ComfyType, InputWidget } from '../types/node.types'

export interface ParsedNodeCode {
  inputs: NodeInput[]
  outputs: NodeOutput[]
  executeBody: string
}

const VALID_COMFY_TYPES = new Set([
  'IMAGE', 'LATENT', 'CONDITIONING', 'MODEL', 'VAE', 'CLIP', 'MASK',
  'CONTROL_NET', 'STYLE_MODEL', 'CLIP_VISION', 'CLIP_VISION_OUTPUT',
  'UPSCALE_MODEL', 'SAMPLER', 'SIGMAS', 'GUIDER', 'NOISE', 'GLIGEN',
  'AUDIO', 'INT', 'FLOAT', 'STRING', 'BOOLEAN', 'SEED', 'COMBO', '*'
])

const WIDGET_TYPES = new Set(['INT', 'FLOAT', 'STRING', 'BOOLEAN', 'COMBO'])

/** Return the index of the matching closing `}` for the `{` at openIdx. */
function findMatchingBrace(str: string, openIdx: number): number {
  let depth = 0
  for (let i = openIdx; i < str.length; i++) {
    if (str[i] === '{') depth++
    else if (str[i] === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/**
 * Extract the content between the braces of `"key": { ... }` in str,
 * handling arbitrarily nested braces.
 */
function extractDictBlock(str: string, key: string): string | null {
  const pat = new RegExp(`"${key}"\\s*:\\s*\\{`)
  const m = pat.exec(str)
  if (!m || m.index === undefined) return null
  const openIdx = str.indexOf('{', m.index + m[0].length - 1)
  if (openIdx === -1) return null
  const closeIdx = findMatchingBrace(str, openIdx)
  if (closeIdx === -1) return null
  return str.slice(openIdx + 1, closeIdx)
}

/** Parse the widget config dict `{ "key": val, … }` starting at offset in content. */
function parseWidgetDict(content: string, offset: number): InputWidget {
  // Find next `{` after offset
  const openIdx = content.indexOf('{', offset)
  if (openIdx === -1) return {}
  const closeIdx = findMatchingBrace(content, openIdx)
  if (closeIdx === -1) return {}
  const dictContent = content.slice(openIdx + 1, closeIdx)

  const w: InputWidget = {}
  // Match key-value pairs — values end at `,` or end of dict (handles multi-line)
  const kvPat = /["'](\w+)["']\s*:\s*([\s\S]*?)(?=\s*,\s*["'\w]|\s*$)/g
  let pair: RegExpExecArray | null
  while ((pair = kvPat.exec(dictContent)) !== null) {
    const key = pair[1]
    const rawVal = pair[2].trim().replace(/,$/, '').trim()
    switch (key) {
      case 'min':   w.min = parseFloat(rawVal); break
      case 'max':   w.max = parseFloat(rawVal); break
      case 'step':  w.step = parseFloat(rawVal); break
      case 'round': w.round = parseFloat(rawVal); break
      case 'multiline': w.multiline = rawVal === 'True'; break
      case 'placeholder': w.placeholder = rawVal.replace(/^["']|["']$/g, ''); break
      case 'default': {
        if (rawVal === 'True') w.default = true
        else if (rawVal === 'False') w.default = false
        else if (rawVal.startsWith('"') || rawVal.startsWith("'")) {
          w.default = rawVal.replace(/^["']|["']$/g, '')
        } else if (!isNaN(Number(rawVal)) && rawVal !== '') {
          w.default = Number(rawVal)
        }
        break
      }
    }
  }
  return w
}

/**
 * Parse a full Python node file (or LLM-generated code) and extract inputs,
 * outputs, and execute body. Returns null if nothing useful could be parsed.
 */
export function parseNodeCode(
  text: string,
  node: ComfyNodeDef
): ParsedNodeCode | null {
  // Strip markdown code fences if present
  let code = text.trim()
  const pyMatch = code.match(/```(?:python)?\s*\n([\s\S]*?)```/)
  if (pyMatch) code = pyMatch[1].trim()

  // ── INPUT_TYPES ──────────────────────────────────────────────────────────
  const inputs: NodeInput[] = []

  // Find the INPUT_TYPES method and extract the return { ... } block
  const inputTypesStart = code.search(/def\s+INPUT_TYPES\s*\(/)
  if (inputTypesStart !== -1) {
    const afterDef = code.slice(inputTypesStart)
    const returnMatch = afterDef.match(/return\s*\{/)
    if (returnMatch && returnMatch.index !== undefined) {
      const openIdx = afterDef.indexOf('{', returnMatch.index + returnMatch[0].length - 1)
      const closeIdx = findMatchingBrace(afterDef, openIdx)
      if (openIdx !== -1 && closeIdx !== -1) {
        const block = afterDef.slice(openIdx + 1, closeIdx)

        const requiredBlock = extractDictBlock(block, 'required')
        const optionalBlock = extractDictBlock(block, 'optional')

        const parseInputBlock = (content: string, required: boolean): void => {
          // Match "name": ( at start of each input entry
          const inputPattern = /"(\w+)"\s*:\s*\(/g
          let m: RegExpExecArray | null
          while ((m = inputPattern.exec(content)) !== null) {
            const name = m[1]
            const afterParen = content.slice(m.index + m[0].length)

            let type: string
            let comboOptions: string[] | undefined
            let widgetDictOffset = 0

            // Determine type: either ["opt1", …] for COMBO or "TYPE"
            const listMatch = afterParen.match(/^\s*(\[[\s\S]*?\])/)
            const strMatch = afterParen.match(/^\s*"([^"]+)"/)

            if (listMatch) {
              type = 'COMBO'
              try {
                comboOptions = JSON.parse(listMatch[1].replace(/'/g, '"'))
              } catch {
                comboOptions = []
              }
              widgetDictOffset = listMatch[0].length
            } else if (strMatch) {
              type = strMatch[1].toUpperCase()
              widgetDictOffset = strMatch[0].length
            } else {
              continue
            }

            if (!VALID_COMFY_TYPES.has(type)) continue

            const existingInput = node.inputs.find((i) => i.name === name)
            const isWidget = WIDGET_TYPES.has(type)
            const input: NodeInput = {
              id: existingInput?.id ?? crypto.randomUUID(),
              name,
              type: type as ComfyType,
              required,
              tooltip: existingInput?.tooltip ?? '',
              forceInput: isWidget ? (existingInput?.forceInput ?? false) : false
            }

            if (type === 'COMBO' && comboOptions) {
              // Check for optional config dict after the list
              const afterList = afterParen.slice(widgetDictOffset)
              const hasDictAhead = /^\s*,\s*\{/.test(afterList)
              let comboDefault: string | undefined
              if (hasDictAhead) {
                const w = parseWidgetDict(afterList, afterList.indexOf('{'))
                if (typeof w.default === 'string') comboDefault = w.default
              }
              input.widget = { comboOptions, default: comboDefault ?? comboOptions[0] }
              input.forceInput = false
            } else if (isWidget) {
              // Check for optional config dict after the type string
              const afterType = afterParen.slice(widgetDictOffset)
              const hasDictAhead = /^\s*,\s*\{/.test(afterType)
              if (hasDictAhead) {
                const w = parseWidgetDict(afterType, afterType.indexOf('{'))
                input.widget = w
              } else {
                // No dict in code — widget with no config
                input.widget = {}
              }
            }

            inputs.push(input)
          }
        }

        if (requiredBlock !== null) parseInputBlock(requiredBlock, true)
        if (optionalBlock !== null) parseInputBlock(optionalBlock, false)
      }
    }
  }

  // ── RETURN_TYPES / RETURN_NAMES ───────────────────────────────────────────
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
      if (!VALID_COMFY_TYPES.has(t)) return
      const existingOutput = node.outputs.find((o) => o.name === (names[i] ?? `output_${i}`))
      outputs.push({
        id: existingOutput?.id ?? crypto.randomUUID(),
        name: names[i] ?? `output_${i}`,
        type: t as ComfyType,
        tooltip: existingOutput?.tooltip ?? ''
      })
    })
  }

  // ── Execute body ──────────────────────────────────────────────────────────
  const funcName = node.functionName || 'execute'
  const funcPattern = new RegExp(
    `def\\s+${funcName}\\s*\\(self[^)]*\\)\\s*:\\s*\\n((?:        [^\\n]*\\n?|\\s*\\n)*)`,
    'm'
  )
  const funcMatch = code.match(funcPattern)
  let executeBody = node.executeBody

  if (funcMatch) {
    const rawBody = funcMatch[1].replace(/\s+$/, '')
    executeBody = rawBody || '        pass'
  }

  // Return null only if we found absolutely nothing useful
  if (inputs.length === 0 && outputs.length === 0 && executeBody === node.executeBody) {
    return null
  }

  return {
    inputs: inputs.length > 0 ? inputs : node.inputs,
    outputs: outputs.length > 0 ? outputs : node.outputs,
    executeBody
  }
}
