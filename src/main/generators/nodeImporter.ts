import fs from 'fs/promises'
import path from 'path'
import { dialog } from 'electron'

export interface ImportedInput {
  name: string
  type: string
  required: boolean
  forceInput?: boolean
  widget?: {
    min?: number
    max?: number
    step?: number
    defaultValue?: string | number | boolean
    multiline?: boolean
    comboOptions?: string[]
  }
}

export interface ImportedOutput {
  name: string
  type: string
}

export interface ImportedNodeDef {
  internalName: string
  displayName: string
  category: string
  inputs: ImportedInput[]
  outputs: ImportedOutput[]
  functionName: string
  isOutputNode: boolean
  executeBody: string
  sourceFile: string
}

const WIDGET_TYPES = new Set(['INT', 'FLOAT', 'STRING', 'BOOLEAN', 'COMBO'])

// ─── helpers ────────────────────────────────────────────────────────────────

function extractClassBody(source: string, className: string): string | null {
  const lines = source.split('\n')
  // Find the class definition line
  const classLineIdx = lines.findIndex((l) => /^class\s+/.test(l) && l.includes(className))
  if (classLineIdx === -1) return null

  // Find first non-empty line after class definition
  let firstBodyLine = classLineIdx + 1
  while (firstBodyLine < lines.length && lines[firstBodyLine].trim() === '') firstBodyLine++
  if (firstBodyLine >= lines.length) return null

  const classIndent = lines[firstBodyLine].match(/^(\s*)/)?.[1]?.length ?? 0
  if (classIndent === 0) return null

  const bodyLines: string[] = []
  for (let i = firstBodyLine; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim() === '') {
      bodyLines.push(line)
      continue
    }
    const indent = line.match(/^(\s*)/)?.[1]?.length ?? 0
    if (indent < classIndent) break
    bodyLines.push(line)
  }
  return bodyLines.join('\n')
}

function extractStringValue(body: string, key: string): string | null {
  const match = body.match(new RegExp(`${key}\\s*=\\s*["']([^"']+)["']`))
  return match ? match[1] : null
}

function extractTupleValues(body: string, key: string): string[] {
  const match = body.match(new RegExp(`${key}\\s*=\\s*\\(([^)]+)\\)`))
  if (!match) return []
  return match[1]
    .split(',')
    .map((s) => s.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean)
}

function extractBoolValue(body: string, key: string): boolean {
  const match = body.match(new RegExp(`${key}\\s*=\\s*(True|False)`))
  return match ? match[1] === 'True' : false
}

/**
 * Use bracket counting to extract a balanced dict/expression starting at
 * `startIdx` in `source`. Returns the inner content (between outermost braces).
 */
function extractBalancedBraces(source: string, startIdx: number): string {
  let depth = 0
  let start = -1
  for (let i = startIdx; i < source.length; i++) {
    if (source[i] === '{') {
      if (depth === 0) start = i
      depth++
    } else if (source[i] === '}') {
      depth--
      if (depth === 0 && start !== -1) {
        return source.slice(start + 1, i)
      }
    }
  }
  return ''
}

/**
 * Parse a Python dict-like section (required or optional) from the INPUT_TYPES
 * return value. Returns a list of ImportedInput.
 */
function parseSectionInputs(sectionContent: string, required: boolean): ImportedInput[] {
  const inputs: ImportedInput[] = []

  // Match entries: "name": (TYPE_OR_LIST, {...}) or "name": (TYPE_OR_LIST,)
  // We use a simple line-by-line approach with bracket counting
  const entryRe = /["'](\w+)["']\s*:\s*\(/g
  let m: RegExpExecArray | null

  while ((m = entryRe.exec(sectionContent)) !== null) {
    const name = m[1]
    // Find the balanced parenthesis content starting at this match
    const parenStart = sectionContent.indexOf('(', m.index + m[0].length - 1)
    if (parenStart === -1) continue

    // Extract balanced parens
    let depth = 0
    let innerStart = -1
    let innerEnd = -1
    for (let i = parenStart; i < sectionContent.length; i++) {
      if (sectionContent[i] === '(') {
        if (depth === 0) innerStart = i + 1
        depth++
      } else if (sectionContent[i] === ')') {
        depth--
        if (depth === 0) {
          innerEnd = i
          break
        }
      }
    }
    if (innerStart === -1 || innerEnd === -1) continue

    const innerContent = sectionContent.slice(innerStart, innerEnd).trim()

    // First element is either "TYPE" or ["opt1","opt2",...]
    let typeStr = ''
    let comboOptions: string[] | undefined
    let configStr = ''

    if (innerContent.startsWith('[')) {
      // COMBO list
      const listEnd = innerContent.indexOf(']')
      if (listEnd !== -1) {
        const listContent = innerContent.slice(1, listEnd)
        comboOptions = listContent
          .split(',')
          .map((s) => s.trim().replace(/^["']|["']$/g, ''))
          .filter(Boolean)
        typeStr = 'COMBO'
        configStr = innerContent.slice(listEnd + 1).replace(/^\s*,\s*/, '')
      }
    } else {
      // String type
      const typeMatch = innerContent.match(/^["']([^"']+)["']/)
      if (typeMatch) {
        typeStr = typeMatch[1]
        configStr = innerContent.slice(typeMatch[0].length).replace(/^\s*,\s*/, '')
      } else {
        // Might be unquoted uppercase identifier
        const unquotedMatch = innerContent.match(/^([A-Z_*]+)/)
        if (unquotedMatch) {
          typeStr = unquotedMatch[1]
          configStr = innerContent.slice(unquotedMatch[0].length).replace(/^\s*,\s*/, '')
        }
      }
    }

    if (!typeStr) continue

    // Parse optional config dict
    let widget: ImportedInput['widget'] | undefined
    let forceInput = !WIDGET_TYPES.has(typeStr)

    if (configStr.trim().startsWith('{')) {
      const dictContent = extractBalancedBraces(configStr, 0)

      const minMatch = dictContent.match(/["']min["']\s*:\s*([\d.+-]+)/)
      const maxMatch = dictContent.match(/["']max["']\s*:\s*([\d.+-]+)/)
      const stepMatch = dictContent.match(/["']step["']\s*:\s*([\d.+-]+)/)
      const defaultStrMatch = dictContent.match(/["']default["']\s*:\s*["']([^"']*)["']/)
      const defaultNumMatch = dictContent.match(/["']default["']\s*:\s*([\d.+-]+)/)
      const defaultBoolMatch = dictContent.match(/["']default["']\s*:\s*(True|False)/)
      const multilineMatch = dictContent.match(/["']multiline["']\s*:\s*(True|False)/)
      const forceInputMatch = dictContent.match(/["']forceInput["']\s*:\s*(True|False)/)

      if (forceInputMatch) {
        forceInput = forceInputMatch[1] === 'True'
      }

      const hasWidget =
        minMatch || maxMatch || stepMatch || defaultStrMatch || defaultNumMatch ||
        defaultBoolMatch || multilineMatch || comboOptions

      if (hasWidget) {
        widget = {}
        if (minMatch) widget.min = parseFloat(minMatch[1])
        if (maxMatch) widget.max = parseFloat(maxMatch[1])
        if (stepMatch) widget.step = parseFloat(stepMatch[1])
        if (defaultStrMatch) widget.defaultValue = defaultStrMatch[1]
        else if (defaultBoolMatch) widget.defaultValue = defaultBoolMatch[1] === 'True'
        else if (defaultNumMatch) widget.defaultValue = parseFloat(defaultNumMatch[1])
        if (multilineMatch) widget.multiline = multilineMatch[1] === 'True'
        if (comboOptions) widget.comboOptions = comboOptions
      }
    }

    if (comboOptions && !widget) {
      widget = { comboOptions }
    }

    inputs.push({ name, type: typeStr, required, forceInput, widget })
  }

  return inputs
}

function parseInputTypes(classBody: string): ImportedInput[] {
  // Find INPUT_TYPES method and extract its return dict
  const inputTypesIdx = classBody.indexOf('def input_types') !== -1
    ? classBody.indexOf('def input_types')
    : classBody.indexOf('INPUT_TYPES')

  if (inputTypesIdx === -1) return []

  // Find the return { ... } block
  const returnIdx = classBody.indexOf('return {', inputTypesIdx)
  if (returnIdx === -1) return []

  const dictContent = extractBalancedBraces(classBody, returnIdx + 'return '.length)

  // Extract "required" and "optional" sections
  const inputs: ImportedInput[] = []

  const requiredIdx = dictContent.indexOf('"required"')
  const optionalIdx = dictContent.indexOf('"optional"')

  if (requiredIdx !== -1) {
    const braceStart = dictContent.indexOf('{', requiredIdx)
    if (braceStart !== -1) {
      const sectionContent = extractBalancedBraces(dictContent, braceStart)
      inputs.push(...parseSectionInputs(sectionContent, true))
    }
  }

  if (optionalIdx !== -1) {
    const braceStart = dictContent.indexOf('{', optionalIdx)
    if (braceStart !== -1) {
      const sectionContent = extractBalancedBraces(dictContent, braceStart)
      inputs.push(...parseSectionInputs(sectionContent, false))
    }
  }

  return inputs
}

function extractExecuteBody(classBody: string, functionName: string): string {
  const lines = classBody.split('\n')
  const defPattern = new RegExp(`^(\\s*)def\\s+${functionName}\\s*\\(`)
  const defIdx = lines.findIndex((l) => defPattern.test(l))
  if (defIdx === -1) return '        pass'

  const defIndent = lines[defIdx].match(/^(\s*)/)?.[1]?.length ?? 0
  const bodyLines: string[] = []

  for (let i = defIdx + 1; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim() === '') {
      bodyLines.push(line)
      continue
    }
    const indent = line.match(/^(\s*)/)?.[1]?.length ?? 0
    if (indent <= defIndent) break
    bodyLines.push(line)
  }

  // Trim trailing blank lines
  while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1].trim() === '') {
    bodyLines.pop()
  }

  return bodyLines.length > 0 ? bodyLines.join('\n') : '        pass'
}

// ─── main parse function ─────────────────────────────────────────────────────

/**
 * Detect top-level relative imports in a Python source file.
 * Returns a map of module name → list of imported names (or ['*'] for star imports).
 */
function detectRelativeImports(source: string): Map<string, string[]> {
  const result = new Map<string, string[]>()
  // Match: from .module import name1, name2  OR  from . import module
  const re = /^from\s+\.(\w+)\s+import\s+(.+)$/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(source)) !== null) {
    const moduleName = m[1]
    const importedNames = m[2].split(',').map((s) => s.trim()).filter(Boolean)
    result.set(moduleName, importedNames)
  }
  // Also match: from . import module1, module2
  const starRe = /^from\s+\.\s+import\s+(.+)$/gm
  while ((m = starRe.exec(source)) !== null) {
    const names = m[1].split(',').map((s) => s.trim()).filter(Boolean)
    for (const name of names) {
      if (!result.has(name)) result.set(name, ['*'])
    }
  }
  return result
}

/**
 * Inline utility module source code into an execute body.
 * Re-indents the utility source to 8 spaces and prepends it with comment delimiters.
 */
function inlineUtilityCode(executeBody: string, moduleName: string, utilSource: string): string {
  // Strip the shebang/encoding lines and filter out relative imports from the utility itself
  const utilLines = utilSource.split('\n').filter((line) => {
    // Skip lines that are relative imports (they won't work when inlined)
    if (/^\s*from\s+\./.test(line)) return false
    return true
  })

  // Re-indent: add 8 spaces to each non-empty line
  const indented = utilLines
    .map((line) => (line.trim() === '' ? '' : '        ' + line))
    .join('\n')
    .trimEnd()

  const header = `        # ── Inlined from: ${moduleName}.py (relative import) ──`
  const footer = `        # ── End of ${moduleName}.py ──`

  return `${header}\n${indented}\n${footer}\n\n${executeBody}`
}

export function parseNodeFile(
  source: string,
  filename: string,
  utilityFiles?: Map<string, string>
): ImportedNodeDef[] {
  const nodes: ImportedNodeDef[] = []

  // Find NODE_CLASS_MAPPINGS *assignment* specifically (not import statements).
  // e.g. NODE_CLASS_MAPPINGS = { ... }  or  NODE_CLASS_MAPPINGS={...}
  const classMappingsAssignRe = /\bNODE_CLASS_MAPPINGS\s*=/g
  let classMappingsContent = ''
  let assignMatch: RegExpExecArray | null
  while ((assignMatch = classMappingsAssignRe.exec(source)) !== null) {
    const braceIdx = source.indexOf('{', assignMatch.index + assignMatch[0].length)
    if (braceIdx === -1) continue
    // Make sure nothing meaningful sits between '=' and '{' (just whitespace/newline)
    const between = source.slice(assignMatch.index + assignMatch[0].length, braceIdx)
    if (/[^{\s]/.test(between)) continue // dict comprehension or other expression — skip
    const candidate = extractBalancedBraces(source, braceIdx)
    if (candidate) {
      classMappingsContent = candidate
      break
    }
  }
  if (!classMappingsContent) return []

  const classMappings: Record<string, string> = {}
  // Use a permissive pattern for class name: any non-whitespace/comma/brace sequence
  // This handles Unicode identifiers and emoji-prefixed internal names
  const classEntryRe = /["']([^"']+)["']\s*:\s*([^\s,{}()\[\]'"]+)/g
  let m: RegExpExecArray | null
  while ((m = classEntryRe.exec(classMappingsContent)) !== null) {
    const internalName = m[1]
    const className = m[2]
    // Only accept class names that are valid Python identifiers (no spread **vars)
    if (/^[A-Za-z_]/.test(className) && !className.startsWith('**')) {
      classMappings[internalName] = className
    }
  }

  if (Object.keys(classMappings).length === 0) return []

  // Extract NODE_DISPLAY_NAME_MAPPINGS assignment (same safe approach as above)
  const displayMappings: Record<string, string> = {}
  const displayAssignRe = /\bNODE_DISPLAY_NAME_MAPPINGS\s*=/g
  let displayAssignMatch: RegExpExecArray | null
  while ((displayAssignMatch = displayAssignRe.exec(source)) !== null) {
    const braceIdx = source.indexOf('{', displayAssignMatch.index + displayAssignMatch[0].length)
    if (braceIdx === -1) continue
    const between = source.slice(displayAssignMatch.index + displayAssignMatch[0].length, braceIdx)
    if (/[^{\s]/.test(between)) continue
    const displayContent = extractBalancedBraces(source, braceIdx)
    if (displayContent) {
      const displayEntryRe = /["']([^"']+)["']\s*:\s*["']([^"']+)["']/g
      while ((m = displayEntryRe.exec(displayContent)) !== null) {
        displayMappings[m[1]] = m[2]
      }
      break
    }
  }

  for (const [internalName, className] of Object.entries(classMappings)) {
    // Find the class body — first in this file, then by searching all utility files.
    // This handles __init__.py packs where each class lives in its own imported file.
    let classBody = extractClassBody(source, className)
    let classSource = source

    if (!classBody && utilityFiles) {
      for (const [, utilSource] of utilityFiles) {
        if (utilSource === source) continue
        const found = extractClassBody(utilSource, className)
        if (found) {
          classBody = found
          classSource = utilSource
          break
        }
      }
    }

    if (!classBody) continue

    const category = extractStringValue(classBody, 'CATEGORY') ?? 'custom'
    const returnTypes = extractTupleValues(classBody, 'RETURN_TYPES')
    const returnNames = extractTupleValues(classBody, 'RETURN_NAMES')
    const functionName = extractStringValue(classBody, 'FUNCTION') ?? 'execute'
    const isOutputNode = extractBoolValue(classBody, 'OUTPUT_NODE')

    const outputs: ImportedOutput[] = returnTypes.map((type, i) => ({
      name: returnNames[i] ?? type.toLowerCase(),
      type
    }))

    const inputs = parseInputTypes(classBody)
    let executeBody = extractExecuteBody(classBody, functionName)
    const displayName = displayMappings[internalName] ?? internalName

    // Inline any utility modules imported by the file that defines this class
    if (utilityFiles) {
      const relativeImports = detectRelativeImports(classSource)
      if (relativeImports.size > 0) {
        const modules = Array.from(relativeImports.keys()).reverse()
        for (const moduleName of modules) {
          const utilSource = utilityFiles.get(moduleName)
          if (utilSource) {
            executeBody = inlineUtilityCode(executeBody, moduleName, utilSource)
          }
        }
      }
    }

    nodes.push({
      internalName,
      displayName,
      category,
      inputs,
      outputs,
      functionName,
      isOutputNode,
      executeBody,
      sourceFile: filename
    })
  }

  return nodes
}

// ─── IPC handlers ────────────────────────────────────────────────────────────

export async function handleImportNodeFile(): Promise<ImportedNodeDef[]> {
  const result = await dialog.showOpenDialog({
    title: 'Select Python Node File to Import',
    filters: [{ name: 'Python File', extensions: ['py'] }],
    properties: ['openFile']
  })

  if (result.canceled || !result.filePaths[0]) return []

  const filePath = result.filePaths[0]
  try {
    const source = await fs.readFile(filePath, 'utf-8')
    return parseNodeFile(source, path.basename(filePath))
  } catch {
    return []
  }
}

export async function handleImportNodeFolder(): Promise<ImportedNodeDef[]> {
  const result = await dialog.showOpenDialog({
    title: 'Select ComfyUI Node Pack Folder to Import',
    properties: ['openDirectory']
  })

  if (result.canceled || !result.filePaths[0]) return []

  const dir = result.filePaths[0]

  // ── Pass 1: collect all .py file sources ──────────────────────────────────
  // fileContents: basename (no .py) → source, for all files found across root + subdirs
  const fileContents = new Map<string, string>()

  async function collectPyFiles(scanDir: string): Promise<void> {
    let entries: string[]
    try {
      entries = await fs.readdir(scanDir)
    } catch {
      return
    }
    for (const file of entries) {
      if (!file.endsWith('.py')) continue
      const fullPath = path.join(scanDir, file)
      try {
        const source = await fs.readFile(fullPath, 'utf-8')
        const key = file.slice(0, -3) // strip .py
        fileContents.set(key, source)
      } catch {
        // skip unreadable files
      }
    }
  }

  await collectPyFiles(dir)

  try {
    const rootEntries = await fs.readdir(dir, { withFileTypes: true }) as unknown as import('fs').Dirent[]
    for (const entry of rootEntries) {
      if (entry.isDirectory()) {
        await collectPyFiles(path.join(dir, entry.name))
      }
    }
  } catch {
    // ignore
  }

  // ── Pass 2: parse node files, inlining utilities ──────────────────────────
  const allNodes: ImportedNodeDef[] = []
  const seenInternalNames = new Set<string>()

  for (const [baseName, source] of fileContents) {
    try {
      const parsed = parseNodeFile(source, `${baseName}.py`, fileContents)
      for (const node of parsed) {
        if (!seenInternalNames.has(node.internalName)) {
          seenInternalNames.add(node.internalName)
          allNodes.push(node)
        }
      }
    } catch {
      // skip unparseable files
    }
  }

  return allNodes
}
