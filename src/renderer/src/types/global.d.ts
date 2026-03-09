import type { Project, ComfyNodeDef } from './node.types'
import type { LLMProvider, LLMGenerateRequest } from './llm.types'

declare global {
  interface Window {
    electronAPI: {
      saveProject: (project: Project, currentPath?: string) => Promise<{ path: string }>
      loadProject: () => Promise<Project | null>
      exportCode: (
        nodes: ComfyNodeDef[],
        mode: 'single' | 'package',
        projectName: string
      ) => Promise<void>

      generateLLM: (req: LLMGenerateRequest) => Promise<string>
      testConnection: (provider: LLMProvider, model: string, baseUrl?: string) => Promise<boolean>
      fetchOllamaModels: (baseUrl: string) => Promise<string[]>

      saveApiKey: (provider: LLMProvider, key: string) => Promise<void>
      getApiKeyStatus: () => Promise<Record<string, boolean>>

      saveSettings: (settings: unknown) => Promise<void>
      getSettings: () => Promise<Record<string, unknown> | null>

      setTitle: (title: string) => Promise<void>
    }
  }
}

export {}
