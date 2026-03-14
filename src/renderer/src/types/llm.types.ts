export type LLMProvider =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'groq'
  | 'xai'
  | 'openrouter'
  | 'ollama'

export interface LLMProviderConfig {
  provider: LLMProvider
  model: string
  baseUrl?: string
}

export interface LLMSettings {
  activeProvider: LLMProvider
  providers: Record<LLMProvider, LLMProviderConfig>
}

export interface LLMGenerateRequest {
  provider: LLMProvider
  model: string
  baseUrl?: string
  systemPrompt: string
  userPrompt: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'error' | 'correction' | 'rejection'
  content: string
  timestamp: number
  elapsedMs?: number
  mode?: 'execute' | 'fullnode'
  nodeId?: string
  responseStatus?: 'ok' | 'parse_failed' | 'all_invalid'
  provider?: LLMProvider
  model?: string
}

export interface LLMChatRequest {
  provider: LLMProvider
  model: string
  baseUrl?: string
  systemPrompt: string
  messages: { role: 'user' | 'assistant'; content: string }[]
  requestId: string
}

export const DEFAULT_MODELS: Record<LLMProvider, string[]> = {
  openai: ['gpt-5.4', 'gpt-5.4-pro', 'gpt-5.3-instant', 'gpt-4o', 'gpt-4o-mini'],
  anthropic: [
    'claude-opus-4-6',
    'claude-sonnet-4-6',
    'claude-haiku-4-5-20251001'
  ],
  google: ['gemini-3.1-pro', 'gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash'],
  groq: [
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'groq/compound',
    'groq/compound-mini',
    'moonshotai/kimi-k2-instruct-0905',
    'qwen/qwen3-32b',
    'meta-llama/llama-4-scout-17b-16e-instruct'
  ],
  xai: ['grok-3', 'grok-3-mini', 'grok-2'],
  openrouter: ['openai/gpt-5.4', 'anthropic/claude-sonnet-4-6', 'google/gemini-3.1-pro', 'meta-llama/llama-3.3-70b-instruct'],
  ollama: []  // Populated dynamically from local Ollama instance
}

export const PROVIDER_LABELS: Record<LLMProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic (Claude)',
  google: 'Google (Gemini)',
  groq: 'Groq',
  xai: 'xAI (Grok)',
  openrouter: 'OpenRouter',
  ollama: 'Ollama (Local)'
}

export const DEFAULT_LLM_SETTINGS: LLMSettings = {
  activeProvider: 'openai',
  providers: {
    openai: { provider: 'openai', model: 'gpt-5.4' },
    anthropic: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
    google: { provider: 'google', model: 'gemini-3.1-pro' },
    groq: { provider: 'groq', model: 'openai/gpt-oss-120b' },
    xai: { provider: 'xai', model: 'grok-3', baseUrl: 'https://api.x.ai/v1' },
    openrouter: {
      provider: 'openrouter',
      model: 'openai/gpt-5.4',
      baseUrl: 'https://openrouter.ai/api/v1'
    },
    ollama: { provider: 'ollama', model: '', baseUrl: 'http://localhost:11434' }
  }
}
