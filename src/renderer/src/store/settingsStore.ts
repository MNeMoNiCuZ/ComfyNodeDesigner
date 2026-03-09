import { create } from 'zustand'
import { type LLMProvider, type LLMSettings, DEFAULT_LLM_SETTINGS } from '../types/llm.types'

interface SettingsState {
  llm: LLMSettings
  theme: 'dark' | 'light'
  ollamaModels: string[]
  ollamaFetched: boolean
  customInstructions: string
  activeEditorTab: string
  llmGenerating: boolean

  setActiveProvider: (provider: LLMProvider) => void
  setProviderModel: (provider: LLMProvider, model: string) => void
  setProviderBaseUrl: (provider: LLMProvider, baseUrl: string) => void
  setTheme: (theme: 'dark' | 'light') => void
  setCustomInstructions: (instructions: string) => void
  setActiveEditorTab: (tab: string) => void
  setLLMGenerating: (generating: boolean) => void
  loadFromMain: () => Promise<void>
  persistToMain: () => Promise<void>
  fetchOllamaModels: () => Promise<string[]>
}

function serializableSettings(llm: LLMSettings): Record<string, unknown> {
  // Strip any undefined values so JSON round-trips cleanly
  return JSON.parse(JSON.stringify({ activeProvider: llm.activeProvider, providers: llm.providers }))
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  llm: DEFAULT_LLM_SETTINGS,
  theme: 'dark',
  ollamaModels: [],
  ollamaFetched: false,
  customInstructions: '',
  activeEditorTab: 'identity',
  llmGenerating: false,

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
      window.electronAPI.saveSettings({
        ...serializableSettings(state.llm),
        customInstructions: instructions
      })
    } catch {
      // non-fatal
    }
  },

  setActiveEditorTab: (tab) => set({ activeEditorTab: tab }),

  setLLMGenerating: (generating) => set({ llmGenerating: generating }),

  loadFromMain: async () => {
    try {
      const saved = await window.electronAPI.getSettings()
      if (saved && saved.activeProvider && saved.providers) {
        set((state) => ({
          llm: {
            ...DEFAULT_LLM_SETTINGS,
            ...(saved as Partial<LLMSettings>),
            providers: {
              ...DEFAULT_LLM_SETTINGS.providers,
              ...(saved.providers as LLMSettings['providers'])
            }
          },
          customInstructions: typeof saved.customInstructions === 'string' ? saved.customInstructions : state.customInstructions
        }))
      }
    } catch {
      // first run — use defaults
    }
  },

  persistToMain: async () => {
    try {
      const state = get()
      await window.electronAPI.saveSettings({
        ...serializableSettings(state.llm),
        customInstructions: state.customInstructions
      })
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
