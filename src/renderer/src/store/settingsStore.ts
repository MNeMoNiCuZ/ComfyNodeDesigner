import { create } from 'zustand'
import { type LLMProvider, type LLMSettings, DEFAULT_LLM_SETTINGS } from '../types/llm.types'

interface SettingsState {
  llm: LLMSettings
  theme: 'dark' | 'light'

  setActiveProvider: (provider: LLMProvider) => void
  setProviderModel: (provider: LLMProvider, model: string) => void
  setProviderBaseUrl: (provider: LLMProvider, baseUrl: string) => void
  setTheme: (theme: 'dark' | 'light') => void
  loadFromMain: () => Promise<void>
  persistToMain: () => Promise<void>
}

function serializableSettings(llm: LLMSettings): Record<string, unknown> {
  // Strip any undefined values so JSON round-trips cleanly
  return JSON.parse(JSON.stringify({ activeProvider: llm.activeProvider, providers: llm.providers }))
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  llm: DEFAULT_LLM_SETTINGS,
  theme: 'dark',

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
          }
        }))
      }
    } catch {
      // first run — use defaults
    }
  },

  persistToMain: async () => {
    try {
      await window.electronAPI.saveSettings(serializableSettings(get().llm))
    } catch {
      // non-fatal
    }
  }
}))
