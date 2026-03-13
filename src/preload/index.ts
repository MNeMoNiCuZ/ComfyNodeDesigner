import { contextBridge, ipcRenderer } from 'electron'

// Expose a type-safe API to the renderer without nodeIntegration
contextBridge.exposeInMainWorld('electronAPI', {
  // Project file operations
  saveProject: (project: unknown, currentPath?: string) =>
    ipcRenderer.invoke('file:save-project', project, currentPath),

  loadProject: () => ipcRenderer.invoke('file:load-project'),

  exportCode: (nodes: unknown, mode: 'individual' | 'package', projectName: string) =>
    ipcRenderer.invoke('file:export-code', nodes, mode, projectName),

  // LLM
  generateLLM: (req: unknown) => ipcRenderer.invoke('llm:generate', req),

  generateLLMChat: (req: unknown) => ipcRenderer.invoke('llm:generate-chat', req),

  abortLLM: (requestId: string) => ipcRenderer.invoke('llm:abort', requestId),

  testConnection: (provider: string, model: string, baseUrl?: string) =>
    ipcRenderer.invoke('llm:test-connection', provider, model, baseUrl),

  fetchOllamaModels: (baseUrl: string) =>
    ipcRenderer.invoke('llm:fetch-ollama-models', baseUrl),

  fetchGroqModels: () =>
    ipcRenderer.invoke('llm:fetch-groq-models'),

  // API key management (keys never leave main process memory)
  saveApiKey: (provider: string, key: string) =>
    ipcRenderer.invoke('settings:save-api-key', provider, key),

  getApiKeyStatus: () => ipcRenderer.invoke('settings:get-api-key-status'),

  // Settings (non-sensitive)
  saveSettings: (settings: unknown) => ipcRenderer.invoke('settings:save', settings),

  getSettings: () => ipcRenderer.invoke('settings:load'),

  // Window
  setTitle: (title: string) => ipcRenderer.invoke('window:set-title', title),

  loadProjectFromPath: (filePath: string) => ipcRenderer.invoke('file:load-project-path', filePath),

  // Import
  importNodeFolder: () => ipcRenderer.invoke('file:import-node-folder'),
  importNodeFile: () => ipcRenderer.invoke('file:import-node-file'),

  // Export path helpers
  selectExportFolder: () => ipcRenderer.invoke('file:select-export-folder'),
  exportToPath: (nodes: unknown, packName: string, exportPath: string) =>
    ipcRenderer.invoke('file:export-to-path', nodes, packName, exportPath),

  // Native OS confirmation dialog (avoids ugly browser-style window.confirm)
  showConfirmDialog: (message: string, detail?: string) =>
    ipcRenderer.invoke('window:confirm', message, detail),

  // Window close handling — main sends 'check-before-close', renderer decides
  onCheckClose: (handler: () => void) => {
    ipcRenderer.on('check-before-close', () => handler())
  },
  forceClose: () => ipcRenderer.send('force-close')
})
