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
}

export const useSettingsStore = create<SettingsState>((set) => ({
  llm: DEFAULT_LLM_SETTINGS,
  theme: 'dark',

  setActiveProvider: (provider) =>
    set((state) => ({
      llm: { ...state.llm, activeProvider: provider }
    })),

  setProviderModel: (provider, model) =>
    set((state) => ({
      llm: {
        ...state.llm,
        providers: {
          ...state.llm.providers,
          [provider]: { ...state.llm.providers[provider], model }
        }
      }
    })),

  setProviderBaseUrl: (provider, baseUrl) =>
    set((state) => ({
      llm: {
        ...state.llm,
        providers: {
          ...state.llm.providers,
          [provider]: { ...state.llm.providers[provider], baseUrl }
        }
      }
    })),

  setTheme: (theme) => set({ theme }),

  loadFromMain: async () => {
    try {
      const settings = await window.electronAPI.getSettings()
      if (settings) {
        set((state) => ({
          llm: { ...state.llm, ...settings }
        }))
      }
    } catch (e) {
      // settings not yet saved, use defaults
    }
  }
}))
