import { create } from 'zustand'
import { type LLMProvider, type LLMSettings, DEFAULT_LLM_SETTINGS, type ChatMessage } from '../types/llm.types'

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
  instructionScope: 'global' | 'provider' | 'model'
  providerInstructions: Partial<Record<string, string>>
  modelInstructions: Record<string, string>
  typeColorOverrides: Record<string, string>
  activeEditorTab: string
  llmGenerating: boolean
  recentProjects: RecentProject[]
  maxRecentProjects: number
  recentProjectsEnabled: boolean
  customModels: Partial<Record<LLMProvider, string[]>>
  chatHistories: Record<string, { execute: ChatMessage[]; fullnode: ChatMessage[] }>
  contextMessageCount: number
  pendingProposal: { nodeId: string; messageId: string; operations: any[] } | null

  setActiveProvider: (provider: LLMProvider) => void
  setProviderModel: (provider: LLMProvider, model: string) => void
  setProviderBaseUrl: (provider: LLMProvider, baseUrl: string) => void
  setTheme: (theme: 'dark' | 'light') => void
  setCustomInstructions: (instructions: string) => void
  setInstructionScope: (scope: 'global' | 'provider' | 'model') => void
  setProviderInstruction: (provider: string, text: string) => void
  setModelInstruction: (providerModel: string, text: string) => void
  getEffectiveInstructions: (provider: string, model: string) => string
  setTypeColorOverride: (type: string, hex: string) => void
  resetTypeColorOverride: (type: string) => void
  setActiveEditorTab: (tab: string) => void
  setLLMGenerating: (generating: boolean) => void
  addRecentProject: (path: string, name: string) => void
  clearRecentProjects: () => void
  setMaxRecentProjects: (n: number) => void
  setRecentProjectsEnabled: (enabled: boolean) => void
  addCustomModel: (provider: LLMProvider, model: string) => void
  removeCustomModel: (provider: LLMProvider, model: string) => void
  setChatHistory: (nodeId: string, mode: 'execute' | 'fullnode', messages: ChatMessage[]) => void
  clearChatHistory: (nodeId: string) => void
  setContextMessageCount: (n: number) => void
  setPendingProposal: (proposal: { nodeId: string; messageId: string; operations: any[] } | null) => void
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
  instructionScope: 'provider',
  providerInstructions: {},
  modelInstructions: {},
  typeColorOverrides: {},
  activeEditorTab: 'identity',
  llmGenerating: false,
  recentProjects: [],
  maxRecentProjects: 10,
  recentProjectsEnabled: true,
  customModels: {},
  chatHistories: {},
  contextMessageCount: 10,
  pendingProposal: null,

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
    get().persistToMain()
  },

  setInstructionScope: (scope) => {
    set({ instructionScope: scope })
    get().persistToMain()
  },

  setProviderInstruction: (provider, text) => {
    set((state) => ({
      providerInstructions: { ...state.providerInstructions, [provider]: text }
    }))
    get().persistToMain()
  },

  setModelInstruction: (providerModel, text) => {
    set((state) => ({
      modelInstructions: { ...state.modelInstructions, [providerModel]: text }
    }))
    get().persistToMain()
  },

  getEffectiveInstructions: (provider, model) => {
    const state = get()
    switch (state.instructionScope) {
      case 'provider':
        return state.providerInstructions[provider] ?? ''
      case 'model':
        return state.modelInstructions[`${provider}:${model}`] ?? ''
      case 'global':
      default:
        return state.customInstructions
    }
  },

  setTypeColorOverride: (type, hex) => {
    set((state) => ({
      typeColorOverrides: { ...state.typeColorOverrides, [type]: hex }
    }))
    get().persistToMain()
  },

  resetTypeColorOverride: (type) => {
    set((state) => {
      const overrides = { ...state.typeColorOverrides }
      delete overrides[type]
      return { typeColorOverrides: overrides }
    })
    get().persistToMain()
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

  addCustomModel: (provider, model) => {
    const trimmed = model.trim()
    if (!trimmed) return
    set((state) => {
      const existing = state.customModels[provider] ?? []
      if (existing.includes(trimmed)) return state
      return { customModels: { ...state.customModels, [provider]: [...existing, trimmed] } }
    })
    get().persistToMain()
  },

  removeCustomModel: (provider, model) => {
    set((state) => {
      const existing = state.customModels[provider] ?? []
      return { customModels: { ...state.customModels, [provider]: existing.filter((m) => m !== model) } }
    })
    get().persistToMain()
  },

  setChatHistory: (nodeId, mode, messages) => {
    set((state) => ({
      chatHistories: {
        ...state.chatHistories,
        [nodeId]: {
          ...(state.chatHistories[nodeId] ?? { execute: [], fullnode: [] }),
          [mode]: messages
        }
      }
    }))
    get().persistToMain()
  },

  clearChatHistory: (nodeId) => {
    set((state) => {
      const histories = { ...state.chatHistories }
      delete histories[nodeId]
      return { chatHistories: histories }
    })
    get().persistToMain()
  },

  setContextMessageCount: (n) => {
    set({ contextMessageCount: n })
    get().persistToMain()
  },

  setPendingProposal: (proposal) => {
    set({ pendingProposal: proposal })
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
          if (saved.instructionScope && ['global', 'provider', 'model'].includes(saved.instructionScope as string)) {
            update.instructionScope = saved.instructionScope as 'global' | 'provider' | 'model'
          }
          if (saved.providerInstructions && typeof saved.providerInstructions === 'object') {
            update.providerInstructions = saved.providerInstructions as Partial<Record<string, string>>
          }
          if (saved.modelInstructions && typeof saved.modelInstructions === 'object') {
            update.modelInstructions = saved.modelInstructions as Record<string, string>
          }
          if (saved.typeColorOverrides && typeof saved.typeColorOverrides === 'object') {
            update.typeColorOverrides = saved.typeColorOverrides as Record<string, string>
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
          if (saved.customModels && typeof saved.customModels === 'object') {
            update.customModels = saved.customModels as Partial<Record<LLMProvider, string[]>>
          }
          if (saved.chatHistories && typeof saved.chatHistories === 'object') {
            update.chatHistories = saved.chatHistories as Record<string, { execute: ChatMessage[]; fullnode: ChatMessage[] }>
          }
          if (typeof saved.contextMessageCount === 'number') {
            update.contextMessageCount = saved.contextMessageCount
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
          instructionScope: state.instructionScope,
          providerInstructions: state.providerInstructions,
          modelInstructions: state.modelInstructions,
          typeColorOverrides: state.typeColorOverrides,
          recentProjects: state.recentProjects,
          maxRecentProjects: state.maxRecentProjects,
          recentProjectsEnabled: state.recentProjectsEnabled,
          customModels: state.customModels,
          chatHistories: state.chatHistories,
          contextMessageCount: state.contextMessageCount
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
