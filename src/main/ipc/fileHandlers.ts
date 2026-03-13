import { dialog, app } from 'electron'
import fs from 'fs/promises'
import path from 'path'
import type { ComfyNodeDef, Project } from '../../renderer/src/types/node.types'
import { generateAllFiles } from '../generators/codeGenerator'

export async function handleSaveProject(
  project: Project,
  currentPath?: string
): Promise<{ path: string } | null> {
  let filePath = currentPath
  if (!filePath) {
    const result = await dialog.showSaveDialog({
      title: 'Save Project',
      defaultPath: `${project.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.cnd`,
      filters: [
        { name: 'ComfyNode Designer Project', extensions: ['cnd'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    if (result.canceled || !result.filePath) {
      return null // User cancelled
    }
    filePath = result.filePath
  }
  await fs.writeFile(filePath, JSON.stringify(project, null, 2), 'utf-8')
  return { path: filePath }
}

export async function handleLoadProject(): Promise<{ project: Project; filePath: string } | null> {
  const result = await dialog.showOpenDialog({
    title: 'Open Project',
    filters: [
      { name: 'ComfyNode Designer Project', extensions: ['cnd'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  })
  if (result.canceled || !result.filePaths[0]) return null
  const content = await fs.readFile(result.filePaths[0], 'utf-8')
  const project = JSON.parse(content) as Project
  return { project, filePath: result.filePaths[0] }
}

export async function handleExportCode(
  nodes: ComfyNodeDef[],
  mode: 'individual' | 'package',
  projectName: string
): Promise<void> {
  const files = generateAllFiles(nodes, projectName)

  if (mode === 'individual') {
    const result = await dialog.showOpenDialog({
      title: 'Select Export Directory',
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || !result.filePaths[0]) return
    const sanitized = projectName.replace(/[^a-zA-Z0-9_-]/g, '_')
    const dir = path.join(result.filePaths[0], sanitized)
    const nodesDir = path.join(dir, 'nodes')
    await fs.mkdir(nodesDir, { recursive: true })
    // Write individual node files into nodes/ subfolder
    for (const [nodeName, content] of Object.entries(files.nodeFiles)) {
      await fs.writeFile(path.join(nodesDir, `${nodeName}.py`), content, 'utf-8')
    }
    await fs.writeFile(path.join(dir, '__init__.py'), files.initPyIndividual, 'utf-8')
    // Only write requirements.txt if it has real (non-comment) content
    const reqContent = files.requirementsTxt.trim()
    const hasRealRequirements = reqContent.split('\n').some((line) => line.trim() && !line.startsWith('#'))
    if (hasRealRequirements) {
      await fs.writeFile(path.join(dir, 'requirements.txt'), files.requirementsTxt, 'utf-8')
    }
    await fs.writeFile(path.join(dir, 'README.md'), files.readmeMd, 'utf-8')
  } else {
    const result = await dialog.showOpenDialog({
      title: 'Select Export Directory',
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || !result.filePaths[0]) return
    const sanitized = projectName.replace(/[^a-zA-Z0-9_-]/g, '_')
    const dir = path.join(result.filePaths[0], sanitized)
    const nodesDir = path.join(dir, 'nodes')
    await fs.mkdir(nodesDir, { recursive: true })
    await fs.writeFile(path.join(nodesDir, `${sanitized}_nodes.py`), files.nodesPy, 'utf-8')
    await fs.writeFile(path.join(dir, '__init__.py'), files.initPy, 'utf-8')
    await fs.writeFile(path.join(dir, 'requirements.txt'), files.requirementsTxt, 'utf-8')
    await fs.writeFile(path.join(dir, 'README.md'), files.readmeMd, 'utf-8')
  }
}

export async function handleSaveSettings(settings: Record<string, unknown>): Promise<void> {
  const settingsPath = path.join(app.getPath('userData'), 'settings.json')
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8')
}

export async function handleLoadSettings(): Promise<Record<string, unknown> | null> {
  const settingsPath = path.join(app.getPath('userData'), 'settings.json')
  try {
    const content = await fs.readFile(settingsPath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return null
  }
}

export async function handleSaveApiKey(
  provider: string,
  key: string,
  safeStorage: Electron.SafeStorage
): Promise<void> {
  const keysPath = path.join(app.getPath('userData'), 'api-keys.bin')
  let keys: Record<string, string> = {}
  try {
    const existing = await fs.readFile(keysPath)
    const decrypted = safeStorage.decryptString(existing)
    keys = JSON.parse(decrypted)
  } catch {
    // no existing keys
  }
  if (key) {
    keys[provider] = key
  } else {
    delete keys[provider]
  }
  const encrypted = safeStorage.encryptString(JSON.stringify(keys))
  await fs.writeFile(keysPath, encrypted)
}

export async function handleGetApiKeys(
  safeStorage: Electron.SafeStorage
): Promise<Record<string, string>> {
  const keysPath = path.join(app.getPath('userData'), 'api-keys.bin')
  try {
    const data = await fs.readFile(keysPath)
    const decrypted = safeStorage.decryptString(data)
    return JSON.parse(decrypted)
  } catch {
    return {}
  }
}

export async function handleLoadProjectFromPath(
  filePath: string
): Promise<{ project: Project; filePath: string } | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const project = JSON.parse(content) as Project
    return { project, filePath }
  } catch {
    return null
  }
}

export async function handleExportToPath(
  nodes: ComfyNodeDef[],
  projectName: string,
  exportPath: string
): Promise<string> {
  const files = generateAllFiles(nodes, projectName)
  const sanitized = projectName.replace(/[^a-zA-Z0-9_-]/g, '_')
  const packDir = path.join(exportPath, sanitized)
  const nodesDir = path.join(packDir, 'nodes')
  await fs.mkdir(nodesDir, { recursive: true })
  for (const [nodeName, content] of Object.entries(files.nodeFiles)) {
    await fs.writeFile(path.join(nodesDir, `${nodeName}.py`), content, 'utf-8')
  }
  await fs.writeFile(path.join(packDir, '__init__.py'), files.initPyIndividual, 'utf-8')
  const reqContent = files.requirementsTxt.trim()
  const hasRealRequirements = reqContent.split('\n').some((line) => line.trim() && !line.startsWith('#'))
  if (hasRealRequirements) {
    await fs.writeFile(path.join(packDir, 'requirements.txt'), files.requirementsTxt, 'utf-8')
  }
  await fs.writeFile(path.join(packDir, 'README.md'), files.readmeMd, 'utf-8')
  return packDir
}

export { handleImportNodeFolder, handleImportNodeFile } from '../generators/nodeImporter'
