import type { Project, ComfyNodeDef } from './node.types'
import type { LLMProvider, LLMGenerateRequest, LLMChatRequest } from './llm.types'

declare global {
  interface Window {
    electronAPI: {
      saveProject: (project: Project, currentPath?: string) => Promise<{ path: string } | null>
      loadProject: () => Promise<{ project: Project; filePath: string } | null>
      exportCode: (
        nodes: ComfyNodeDef[],
        mode: 'single' | 'package',
        projectName: string
      ) => Promise<void>

      generateLLM: (req: LLMGenerateRequest) => Promise<string>
      generateLLMChat: (req: LLMChatRequest) => Promise<string>
      abortLLM: (requestId: string) => Promise<void>
      testConnection: (provider: LLMProvider, model: string, baseUrl?: string) => Promise<boolean>
      fetchOllamaModels: (baseUrl: string) => Promise<string[]>

      saveApiKey: (provider: LLMProvider, key: string) => Promise<void>
      getApiKeyStatus: () => Promise<Record<string, boolean>>

      saveSettings: (settings: unknown) => Promise<void>
      getSettings: () => Promise<Record<string, unknown> | null>

      setTitle: (title: string) => Promise<void>

      loadProjectFromPath: (filePath: string) => Promise<{ project: Project; filePath: string } | null>
      importNodeFolder: () => Promise<any[]>
    }
  }
}

export {}
