import type { ComfyNodeDef, NodeInput, ComfyType } from '../../renderer/src/types/node.types'

const SEED_AS_INT_MAX = '0xffffffffffffffff'

export interface GeneratedFiles {
  /** nodes.py — all node classes */
  nodesPy: string
  /** __init__.py — mappings and web_ui dir support */
  initPy: string
  /** requirements.txt placeholder */
  requirementsTxt: string
  /** README.md auto-generated */
  readmeMd: string
  /** single combined .py file */
  singleFilePy: string
}

const WIDGET_TYPES = new Set<ComfyType>(['INT', 'FLOAT', 'STRING', 'BOOLEAN', 'COMBO'])

/**
 * Normalize execute body indentation to exactly 8 spaces.
 * Handles LLM output that may have 0, 4, or inconsistent indentation.
 */
function normalizeExecuteBody(body: string): string {
  const lines = body.split('\n')
  const nonEmpty = lines.filter((l) => l.trim() !== '')
  if (nonEmpty.length === 0) return '        pass'
  const minIndent = Math.min(...nonEmpty.map((l) => l.match(/^(\s*)/)?.[1].length ?? 0))
  return lines
    .map((l) => {
      if (l.trim() === '') return ''
      return '        ' + l.slice(minIndent)
    })
    .join('\n')
}

function isWidget(input: NodeInput): boolean {
  return WIDGET_TYPES.has(input.type) && !input.forceInput
}

/**
 * Generate the INPUT_TYPES dict for a node class.
 */
function generateInputTypes(node: ComfyNodeDef): string {
  const required: string[] = []
  const optional: string[] = []

  for (const input of node.inputs) {
    const lines: string[] = []

    if (isWidget(input)) {
      const cfg: string[] = []

      if (input.widget) {
        const w = input.widget
        if (input.type === 'INT') {
          if (w.default !== undefined) cfg.push(`"default": ${w.default}`)
          if (w.min !== undefined) cfg.push(`"min": ${w.min}`)
          if (w.max !== undefined) cfg.push(`"max": ${w.max}`)
          if (w.step !== undefined) cfg.push(`"step": ${w.step}`)
        } else if (input.type === 'FLOAT') {
          if (w.default !== undefined) cfg.push(`"default": ${w.default}`)
          if (w.min !== undefined) cfg.push(`"min": ${w.min}`)
          if (w.max !== undefined) cfg.push(`"max": ${w.max}`)
          if (w.step !== undefined) cfg.push(`"step": ${w.step}`)
          if (w.round !== undefined) cfg.push(`"round": ${w.round}`)
        } else if (input.type === 'STRING') {
          if (w.multiline) cfg.push(`"multiline": True`)
          if (w.default !== undefined) cfg.push(`"default": ${JSON.stringify(w.default)}`)
        } else if (input.type === 'BOOLEAN') {
          if (w.default !== undefined) cfg.push(`"default": ${w.default ? 'True' : 'False'}`)
        } else if (input.type === 'COMBO') {
          // COMBO handled separately below
        }
      }

      if (input.type === 'COMBO') {
        const options = input.widget?.comboOptions ?? []
        const defaultVal = input.widget?.default ?? (options[0] ?? '')
        const optList = options.map((o) => JSON.stringify(o)).join(', ')
        if (cfg.length === 0) {
          lines.push(`"${input.name}": ([${optList}],),`)
        } else {
          cfg.unshift(`"default": ${JSON.stringify(defaultVal)}`)
          lines.push(`"${input.name}": ([${optList}], {`)
          cfg.forEach((c) => lines.push(`    ${c},`))
          lines.push(`}),`)
        }
      } else {
        if (cfg.length === 0) {
          lines.push(`"${input.name}": ("${input.type}",),`)
        } else {
          lines.push(`"${input.name}": ("${input.type}", {`)
          cfg.forEach((c) => lines.push(`    ${c},`))
          lines.push(`}),`)
        }
      }

      if (input.tooltip) {
        lines[0] = `# ${input.tooltip}\n            ` + lines[0]
      }

      const entry = lines.join('\n            ')
      if (input.required) {
        required.push(entry)
      } else {
        optional.push(entry)
      }
    } else if (input.type === 'SEED') {
      // SEED generates as INT with seed-specific config
      const comment = input.tooltip ? `# ${input.tooltip}\n            ` : ''
      const entry = `${comment}"${input.name}": ("INT", {"default": 0, "min": 0, "max": ${SEED_AS_INT_MAX}}),`
      if (input.required) {
        required.push(entry)
      } else {
        optional.push(entry)
      }
    } else {
      // Socket-only type
      let typeStr: string
      if (input.type === '*') {
        typeStr = '"*"'
      } else {
        typeStr = `"${input.type}"`
      }
      const comment = input.tooltip ? `# ${input.tooltip}\n            ` : ''
      const entry = `${comment}"${input.name}": (${typeStr},),`

      if (input.required) {
        required.push(entry)
      } else {
        optional.push(entry)
      }
    }
  }

  const parts: string[] = []
  parts.push('        "required": {')
  if (required.length === 0) {
    parts.push('        },')
  } else {
    required.forEach((r) => parts.push(`            ${r}`))
    parts.push('        },')
  }

  if (optional.length > 0) {
    parts.push('        "optional": {')
    optional.forEach((o) => parts.push(`            ${o}`))
    parts.push('        },')
  }

  return parts.join('\n')
}

/**
 * Generate function signature args from inputs.
 */
function generateSignatureArgs(node: ComfyNodeDef): string {
  const args = node.inputs.map((i) => i.name)
  return args.join(', ')
}

/**
 * Generate the full Python class for a node.
 */
function generateNodeClass(node: ComfyNodeDef, packName?: string): string {
  const lines: string[] = []

  if (node.description) {
    lines.push(`# ${node.description}`)
  }

  lines.push(`class ${node.internalName}:`)
  lines.push(`    @classmethod`)
  lines.push(`    def INPUT_TYPES(cls):`)
  lines.push(`        return {`)
  lines.push(generateInputTypes(node))
  lines.push(`        }`)
  lines.push(``)

  // RETURN_TYPES
  const returnTypes = node.outputs.map((o) => {
    if (o.type === 'COMBO') return 'STRING'
    if (o.type === 'SEED') return 'INT'
    return o.type
  })
  const returnTypesStr =
    returnTypes.length === 0
      ? '()'
      : returnTypes.length === 1
        ? `("${returnTypes[0]}",)`
        : `(${returnTypes.map((t) => `"${t}"`).join(', ')})`
  lines.push(`    RETURN_TYPES = ${returnTypesStr}`)

  // RETURN_NAMES
  if (node.outputs.length > 0) {
    const names = node.outputs.map((o) => JSON.stringify(o.name))
    const returnNamesStr =
      names.length === 1 ? `(${names[0]},)` : `(${names.join(', ')})`
    lines.push(`    RETURN_NAMES = ${returnNamesStr}`)
  }

  lines.push(`    FUNCTION = "${node.functionName}"`)

  // Category — optionally prefix with pack folder
  const category =
    node.usePackFolder && packName ? `${packName}/${node.category}` : node.category
  lines.push(`    CATEGORY = "${category}"`)

  if (node.isOutputNode) {
    lines.push(`    OUTPUT_NODE = True`)
  }
  if (node.isInputNode) {
    lines.push(`    INPUT_NODE = True`)
  }

  lines.push(``)

  // IS_CHANGED
  if (node.isChangedMode === 'always') {
    lines.push(`    @classmethod`)
    lines.push(`    def IS_CHANGED(cls, **kwargs):`)
    lines.push(`        import time`)
    lines.push(`        return time.time()  # Always re-execute`)
    lines.push(``)
  } else if (node.isChangedMode === 'hash') {
    const argStr = generateSignatureArgs(node)
    const hashArgs = argStr ? argStr : '**kwargs'
    lines.push(`    @classmethod`)
    lines.push(`    def IS_CHANGED(cls, ${hashArgs}):`)
    lines.push(`        import hashlib, json`)
    lines.push(`        # Return a hash of inputs to detect changes`)
    lines.push(`        state = json.dumps({${node.inputs.map((i) => `"${i.name}": str(${i.name})`).join(', ')}}, sort_keys=True)`)
    lines.push(`        return hashlib.md5(state.encode()).hexdigest()`)
    lines.push(``)
  }

  // VALIDATE_INPUTS
  if (node.validateInputs) {
    const argStr = generateSignatureArgs(node)
    lines.push(`    @staticmethod`)
    lines.push(`    def VALIDATE_INPUTS(${argStr}):`)
    lines.push(`        # Add your validation logic here`)
    lines.push(`        # Return True if valid, or a string error message if invalid`)
    lines.push(`        return True`)
    lines.push(``)
  }

  // execute method
  const argStr = generateSignatureArgs(node)
  const selfArgs = argStr ? `self, ${argStr}` : 'self'
  lines.push(`    def ${node.functionName}(${selfArgs}):`)

  const bodyTrimmed = (node.executeBody ?? '').trim()
  if (bodyTrimmed !== '' && bodyTrimmed !== 'pass') {
    // Normalize indentation to 8 spaces regardless of what the LLM returned
    lines.push(normalizeExecuteBody(node.executeBody))
  } else {
    // Placeholder body
    if (node.outputs.length > 0) {
      const returnVars = node.outputs.map((o) => `result_${o.name.toLowerCase().replace(/\s+/g, '_')}`)
      returnVars.forEach((v) => lines.push(`        ${v} = None  # TODO: implement`))
      lines.push(`        return (${returnVars.join(', ')},)`)
    } else {
      lines.push(`        pass`)
    }
  }

  lines.push(``)
  return lines.join('\n')
}

/**
 * Generate the full nodes.py content.
 */
function generateNodesPy(nodes: ComfyNodeDef[], packName?: string): string {
  const parts: string[] = []
  parts.push(`# ComfyUI Custom Nodes`)
  parts.push(`# Generated by ComfyNode Designer`)
  parts.push(`# https://github.com/MNeMoNiCuZ/ComfyNodeDesigner`)
  parts.push(``)
  parts.push(``)

  for (const node of nodes) {
    parts.push(generateNodeClass(node, packName))
    parts.push(``)
  }

  return parts.join('\n').trimEnd() + '\n'
}

/**
 * Generate __init__.py with NODE_CLASS_MAPPINGS and web_directory support.
 */
function generateInitPy(nodes: ComfyNodeDef[], packageMode: boolean, projectName = 'nodes'): string {
  const lines: string[] = []
  const sanitized = projectName.replace(/[^a-zA-Z0-9_-]/g, '_')
  const moduleName = packageMode ? `.nodes.${sanitized}_nodes` : `.nodes`

  lines.push(`# ComfyUI Custom Node Package`)
  lines.push(`# Generated by ComfyNode Designer`)
  lines.push(``)

  if (packageMode) {
    lines.push(`from ${moduleName} import (`)
    nodes.forEach((n) => lines.push(`    ${n.internalName},`))
    lines.push(`)`)
  } else {
    nodes.forEach((n) => lines.push(`from ${moduleName} import ${n.internalName}`))
  }

  lines.push(``)
  lines.push(`NODE_CLASS_MAPPINGS = {`)
  nodes.forEach((n) => lines.push(`    "${n.internalName}": ${n.internalName},`))
  lines.push(`}`)
  lines.push(``)
  lines.push(`NODE_DISPLAY_NAME_MAPPINGS = {`)
  nodes.forEach((n) => lines.push(`    "${n.internalName}": "${n.displayName}",`))
  lines.push(`}`)
  lines.push(``)
  lines.push(`__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]`)
  lines.push(``)

  return lines.join('\n')
}

/**
 * Generate a single-file .py with all nodes + mappings.
 */
function generateSingleFilePy(nodes: ComfyNodeDef[], packName?: string): string {
  const parts: string[] = []
  parts.push(`# ComfyUI Custom Nodes — Single File`)
  parts.push(`# Generated by ComfyNode Designer`)
  parts.push(`# Drop this file into your ComfyUI/custom_nodes/ folder`)
  parts.push(``)
  parts.push(``)

  for (const node of nodes) {
    parts.push(generateNodeClass(node, packName))
    parts.push(``)
  }

  parts.push(``)
  parts.push(`NODE_CLASS_MAPPINGS = {`)
  nodes.forEach((n) => parts.push(`    "${n.internalName}": ${n.internalName},`))
  parts.push(`}`)
  parts.push(``)
  parts.push(`NODE_DISPLAY_NAME_MAPPINGS = {`)
  nodes.forEach((n) => parts.push(`    "${n.internalName}": "${n.displayName}",`))
  parts.push(`}`)
  parts.push(``)
  parts.push(`__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]`)
  parts.push(``)

  return parts.join('\n').trimEnd() + '\n'
}

function generateRequirementsTxt(): string {
  return `# Add your Python package requirements here
# Example:
# torch>=2.0.0
# Pillow>=9.0.0
# numpy>=1.24.0
`
}

function generateReadmeMd(nodes: ComfyNodeDef[], projectName: string): string {
  const lines: string[] = []
  lines.push(`# ${projectName}`)
  lines.push(``)
  lines.push(`Custom ComfyUI nodes generated by [ComfyNode Designer](https://github.com/MNeMoNiCuZ/ComfyNodeDesigner).`)
  lines.push(``)
  lines.push(`## Installation`)
  lines.push(``)
  lines.push(`1. Clone or copy this folder into your \`ComfyUI/custom_nodes/\` directory`)
  lines.push(`2. Install requirements: \`pip install -r requirements.txt\``)
  lines.push(`3. Restart ComfyUI`)
  lines.push(``)
  lines.push(`## Nodes`)
  lines.push(``)

  for (const node of nodes) {
    lines.push(`### ${node.displayName}`)
    if (node.description) {
      lines.push(``)
      lines.push(node.description)
    }
    lines.push(``)
    lines.push(`**Category:** \`${node.category}\``)
    lines.push(``)

    if (node.inputs.length > 0) {
      lines.push(`**Inputs:**`)
      lines.push(``)
      for (const input of node.inputs) {
        const req = input.required ? 'required' : 'optional'
        const tip = input.tooltip ? ` — ${input.tooltip}` : ''
        lines.push(`- \`${input.name}\` (\`${input.type}\`, ${req})${tip}`)
      }
      lines.push(``)
    }

    if (node.outputs.length > 0) {
      lines.push(`**Outputs:**`)
      lines.push(``)
      for (const output of node.outputs) {
        const tip = output.tooltip ? ` — ${output.tooltip}` : ''
        lines.push(`- \`${output.name}\` (\`${output.type}\`)${tip}`)
      }
      lines.push(``)
    }
  }

  return lines.join('\n')
}

/**
 * Main entry point — generate all files for a project.
 * @param nodes - node definitions
 * @param packName - folder/file name used for export (e.g. "ComfyUI_My_Pack")
 * @param displayName - human-readable name used in README (defaults to packName)
 */
export function generateAllFiles(
  nodes: ComfyNodeDef[],
  packName = 'my_comfy_nodes',
  displayName?: string
): GeneratedFiles {
  const title = displayName ?? packName
  if (nodes.length === 0) {
    return {
      nodesPy: '# No nodes defined\n',
      initPy: '# No nodes defined\n',
      requirementsTxt: generateRequirementsTxt(),
      readmeMd: `# ${title}\n\nNo nodes defined yet.\n`,
      singleFilePy: '# No nodes defined\n'
    }
  }

  return {
    nodesPy: generateNodesPy(nodes, packName),
    initPy: generateInitPy(nodes, true, packName),
    requirementsTxt: generateRequirementsTxt(),
    readmeMd: generateReadmeMd(nodes, title),
    singleFilePy: generateSingleFilePy(nodes, packName)
  }
}

/**
 * Build the LLM system prompt for a given node.
 */
export function buildLLMSystemPrompt(node: ComfyNodeDef): string {
  const inputDescs = node.inputs
    .map((i) => {
      const req = i.required ? 'required' : 'optional'
      const tip = i.tooltip ? ` (${i.tooltip})` : ''
      return `  - ${i.name}: ${i.type}${tip} [${req}]`
    })
    .join('\n')

  const outputDescs = node.outputs
    .map((o, idx) => {
      const tip = o.tooltip ? ` (${o.tooltip})` : ''
      return `  - [${idx}] ${o.name}: ${o.type}${tip}`
    })
    .join('\n')

  const argStr = node.inputs.map((i) => i.name).join(', ')
  const selfArgs = argStr ? `self, ${argStr}` : 'self'

  return `You are an expert ComfyUI node developer. Your task is to generate ONLY the body of a Python execute method.

STRICT RULES:
- Output ONLY the method body code, nothing else
- Do NOT include the def line, class definition, decorators, or NODE_CLASS_MAPPINGS
- Indent ALL lines with exactly 8 spaces (the body is inside a class method)
- The first line must be indented with 8 spaces
- Return a Python tuple matching RETURN_TYPES exactly
- If RETURN_TYPES is empty, just use: pass
- You MAY use local imports inside the method body (e.g. import torch)
- Add brief inline comments to explain non-obvious logic
- Write production-quality, clean Python code
- Do NOT add markdown code fences or any other formatting

NODE CONTEXT:
  Node class: ${node.internalName}
  Method signature: def ${node.functionName}(${selfArgs}):
  Category: ${node.category}

INPUTS (parameter names and types):
${inputDescs || '  (none)'}

MUST RETURN (tuple in this exact order):
${outputDescs || '  (no return value — use pass)'}

RETURN_TYPES = ${
    node.outputs.length === 0
      ? '()'
      : node.outputs.length === 1
        ? `("${node.outputs[0].type}",)`
        : `(${node.outputs.map((o) => `"${o.type}"`).join(', ')})`
  }`
}
