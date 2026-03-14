import { app, BrowserWindow, dialog, ipcMain, safeStorage } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import {
  handleSaveProject,
  handleLoadProject,
  handleLoadProjectFromPath,
  handleExportCode,
  handleExportToPath,
  handleSaveApiKey,
  handleGetApiKeys,
  handleSaveSettings,
  handleLoadSettings,
  handleImportNodeFolder,
  handleImportNodeFile
} from './ipc/fileHandlers'
import { handleGenerateLLM, handleGenerateLLMChat, handleTestConnection, handleFetchOllamaModels, handleFetchGroqModels, abortRequest } from './ipc/llmHandlers'
import type { LLMProvider } from '../renderer/src/types/llm.types'

function createWindow(): BrowserWindow {
  const iconPath = is.dev
    ? join(__dirname, '../../src/assets/ComfyUINodeDesigner.png')
    : join(process.resourcesPath, 'icon.png')

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    icon: iconPath,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0f172a',
      symbolColor: '#94a3b8',
      height: 36
    },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  win.on('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.mnemonicuz.comfynodedesigner')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const mainWin = createWindow()

  // Window close — handle via IPC so we can show a confirm dialog reliably
  mainWin.on('close', (e) => {
    e.preventDefault()
    mainWin.webContents.send('check-before-close')
  })
  ipcMain.on('force-close', () => {
    mainWin.destroy()
  })

  // File handlers
  ipcMain.handle('file:save-project', (_, project, currentPath) =>
    handleSaveProject(project, currentPath)
  )
  ipcMain.handle('file:load-project', () => handleLoadProject())
  ipcMain.handle('file:export-code', (_, nodes, mode, projectName) =>
    handleExportCode(nodes, mode, projectName)
  )

  // LLM handlers
  ipcMain.handle('llm:generate', async (_, req) => {
    const keys = await handleGetApiKeys(safeStorage)
    return handleGenerateLLM(req, (provider: LLMProvider) => keys[provider])
  })

  ipcMain.handle('llm:generate-chat', async (_, req) => {
    const keys = await handleGetApiKeys(safeStorage)
    return handleGenerateLLMChat(req, (provider: LLMProvider) => keys[provider])
  })

  ipcMain.handle('llm:abort', (_, requestId) => {
    abortRequest(requestId)
  })

  ipcMain.handle('llm:test-connection', async (_, provider, model, baseUrl) => {
    const keys = await handleGetApiKeys(safeStorage)
    return handleTestConnection(provider, model, baseUrl, (p: LLMProvider) => keys[p])
  })

  ipcMain.handle('llm:fetch-ollama-models', (_, baseUrl) =>
    handleFetchOllamaModels(baseUrl)
  )

  ipcMain.handle('llm:fetch-groq-models', async (_, apiKey) => {
    const key = apiKey ?? (await handleGetApiKeys(safeStorage))['groq'] ?? ''
    if (!key) throw new Error('No Groq API key configured')
    return handleFetchGroqModels(key)
  })

  // Settings handlers
  ipcMain.handle('settings:save-api-key', (_, provider, key) =>
    handleSaveApiKey(provider, key, safeStorage)
  )
  ipcMain.handle('settings:get-api-key-status', async () => {
    const keys = await handleGetApiKeys(safeStorage)
    const status: Record<string, boolean> = {}
    for (const [k, v] of Object.entries(keys)) {
      status[k] = !!v
    }
    return status
  })
  ipcMain.handle('settings:save', (_, settings) => handleSaveSettings(settings))
  ipcMain.handle('settings:load', () => handleLoadSettings())
  ipcMain.handle('window:set-title', (_, title) => mainWin.setTitle(title))
  ipcMain.handle('file:load-project-path', (_, filePath) => handleLoadProjectFromPath(filePath))
  ipcMain.handle('file:import-node-folder', () => handleImportNodeFolder())
  ipcMain.handle('file:import-node-file', () => handleImportNodeFile())

  ipcMain.handle('file:select-export-folder', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Export Folder (point to custom_nodes/)',
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || !result.filePaths[0]) return null
    return result.filePaths[0]
  })

  ipcMain.handle('file:export-to-path', (_, nodes, packName, exportPath) =>
    handleExportToPath(nodes, packName, exportPath)
  )

  ipcMain.handle('window:confirm', async (_, message: string, detail?: string) => {
    const result = await dialog.showMessageBox(mainWin, {
      type: 'question',
      buttons: ['OK', 'Cancel'],
      defaultId: 0,
      cancelId: 1,
      title: 'Comfy Node Designer',
      message,
      detail
    })
    return result.response === 0
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
