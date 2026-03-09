import { contextBridge, ipcRenderer } from 'electron'

// Expose a type-safe API to the renderer without nodeIntegration
contextBridge.exposeInMainWorld('electronAPI', {
  // Project file operations
  saveProject: (project: unknown, currentPath?: string) =>
    ipcRenderer.invoke('file:save-project', project, currentPath),

  loadProject: () => ipcRenderer.invoke('file:load-project'),

  exportCode: (nodes: unknown, mode: 'single' | 'package', projectName: string) =>
    ipcRenderer.invoke('file:export-code', nodes, mode, projectName),

  // LLM
  generateLLM: (req: unknown) => ipcRenderer.invoke('llm:generate', req),

  generateLLMChat: (req: unknown) => ipcRenderer.invoke('llm:generate-chat', req),

  abortLLM: (requestId: string) => ipcRenderer.invoke('llm:abort', requestId),

  testConnection: (provider: string, model: string, baseUrl?: string) =>
    ipcRenderer.invoke('llm:test-connection', provider, model, baseUrl),

  fetchOllamaModels: (baseUrl: string) =>
    ipcRenderer.invoke('llm:fetch-ollama-models', baseUrl),

  // API key management (keys never leave main process memory)
  saveApiKey: (provider: string, key: string) =>
    ipcRenderer.invoke('settings:save-api-key', provider, key),

  getApiKeyStatus: () => ipcRenderer.invoke('settings:get-api-key-status'),

  // Settings (non-sensitive)
  saveSettings: (settings: unknown) => ipcRenderer.invoke('settings:save', settings),

  getSettings: () => ipcRenderer.invoke('settings:load'),

  // Window
  setTitle: (title: string) => ipcRenderer.invoke('window:set-title', title)
})
