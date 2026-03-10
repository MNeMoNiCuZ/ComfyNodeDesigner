import { create } from 'zustand'
import { type LLMProvider, type LLMSettings, DEFAULT_LLM_SETTINGS } from '../types/llm.types'

interface RecentProject {
  path: string
  name: string
  openedAt: string
}

interface SettingsState {
  llm: LLMSettings
  theme: 'dark' | 'light'
  ollamaModels: string[]
  ollamaFetched: boolean
  customInstructions: string
  activeEditorTab: string
  llmGenerating: boolean
  recentProjects: RecentProject[]
  maxRecentProjects: number
  recentProjectsEnabled: boolean

  setActiveProvider: (provider: LLMProvider) => void
  setProviderModel: (provider: LLMProvider, model: string) => void
  setProviderBaseUrl: (provider: LLMProvider, baseUrl: string) => void
  setTheme: (theme: 'dark' | 'light') => void
  setCustomInstructions: (instructions: string) => void
  setActiveEditorTab: (tab: string) => void
  setLLMGenerating: (generating: boolean) => void
  addRecentProject: (path: string, name: string) => void
  clearRecentProjects: () => void
  setMaxRecentProjects: (n: number) => void
  setRecentProjectsEnabled: (enabled: boolean) => void
  loadFromMain: () => Promise<void>
  persistToMain: () => Promise<void>
  fetchOllamaModels: () => Promise<string[]>
}

function serializableSettings(
  llm: LLMSettings,
  extra?: Record<string, unknown>
): Record<string, unknown> {
  // Strip any undefined values so JSON round-trips cleanly
  return JSON.parse(
    JSON.stringify({ activeProvider: llm.activeProvider, providers: llm.providers, ...extra })
  )
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  llm: DEFAULT_LLM_SETTINGS,
  theme: 'dark',
  ollamaModels: [],
  ollamaFetched: false,
  customInstructions: '',
  activeEditorTab: 'identity',
  llmGenerating: false,
  recentProjects: [],
  maxRecentProjects: 10,
  recentProjectsEnabled: true,

  setActiveProvider: (provider) => {
    set((state) => ({ llm: { ...state.llm, activeProvider: provider } }))
    get().persistToMain()
  },

  setProviderModel: (provider, model) => {
    set((state) => ({
      llm: {
        ...state.llm,
        providers: {
          ...state.llm.providers,
          [provider]: { ...state.llm.providers[provider], model }
        }
      }
    }))
    get().persistToMain()
  },

  setProviderBaseUrl: (provider, baseUrl) => {
    set((state) => ({
      llm: {
        ...state.llm,
        providers: {
          ...state.llm.providers,
          [provider]: { ...state.llm.providers[provider], baseUrl }
        }
      }
    }))
    get().persistToMain()
  },

  setTheme: (theme) => set({ theme }),

  setCustomInstructions: (instructions) => {
    set({ customInstructions: instructions })
    // Persist custom instructions along with other settings
    const state = get()
    try {
      const s = get()
      window.electronAPI.saveSettings(
        serializableSettings(s.llm, {
          customInstructions: instructions,
          recentProjects: s.recentProjects,
          maxRecentProjects: s.maxRecentProjects,
          recentProjectsEnabled: s.recentProjectsEnabled
        })
      )
    } catch {
      // non-fatal
    }
  },

  setActiveEditorTab: (tab) => set({ activeEditorTab: tab }),

  setLLMGenerating: (generating) => set({ llmGenerating: generating }),

  addRecentProject: (path, name) => {
    set((state) => {
      const filtered = state.recentProjects.filter((p) => p.path !== path)
      const updated = [{ path, name, openedAt: new Date().toISOString() }, ...filtered].slice(
        0,
        state.maxRecentProjects
      )
      return { recentProjects: updated }
    })
    get().persistToMain()
  },

  clearRecentProjects: () => {
    set({ recentProjects: [] })
    get().persistToMain()
  },

  setMaxRecentProjects: (n) => {
    set((state) => ({
      maxRecentProjects: n,
      recentProjects: state.recentProjects.slice(0, n)
    }))
    get().persistToMain()
  },

  setRecentProjectsEnabled: (enabled) => {
    set({ recentProjectsEnabled: enabled })
    get().persistToMain()
  },

  loadFromMain: async () => {
    try {
      const saved = await window.electronAPI.getSettings()
      if (saved) {
        set((state) => {
          const update: Partial<SettingsState> = {}
          if (saved.activeProvider && saved.providers) {
            update.llm = {
              ...DEFAULT_LLM_SETTINGS,
              ...(saved as Partial<LLMSettings>),
              providers: {
                ...DEFAULT_LLM_SETTINGS.providers,
                ...(saved.providers as LLMSettings['providers'])
              }
            }
          }
          if (typeof saved.customInstructions === 'string') {
            update.customInstructions = saved.customInstructions
          }
          if (Array.isArray(saved.recentProjects)) {
            update.recentProjects = saved.recentProjects as RecentProject[]
          }
          if (typeof saved.maxRecentProjects === 'number') {
            update.maxRecentProjects = saved.maxRecentProjects
          }
          if (typeof saved.recentProjectsEnabled === 'boolean') {
            update.recentProjectsEnabled = saved.recentProjectsEnabled
          }
          return { ...state, ...update }
        })
      }
    } catch {
      // first run — use defaults
    }
  },

  persistToMain: async () => {
    try {
      const state = get()
      await window.electronAPI.saveSettings(
        serializableSettings(state.llm, {
          customInstructions: state.customInstructions,
          recentProjects: state.recentProjects,
          maxRecentProjects: state.maxRecentProjects,
          recentProjectsEnabled: state.recentProjectsEnabled
        })
      )
    } catch {
      // non-fatal
    }
  },

  fetchOllamaModels: async () => {
    try {
      const baseUrl = get().llm.providers.ollama.baseUrl ?? 'http://localhost:11434'
      const models = await window.electronAPI.fetchOllamaModels(baseUrl)
      set({ ollamaModels: models, ollamaFetched: true })
      // Auto-select first model if none selected
      if (!get().llm.providers.ollama.model && models.length > 0) {
        get().setProviderModel('ollama', models[0])
      }
      return models
    } catch {
      set({ ollamaFetched: true })
      return []
    }
  }
}))
