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

export const DEFAULT_MODELS: Record<LLMProvider, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1', 'o1-mini'],
  anthropic: [
    'claude-sonnet-4-6',
    'claude-opus-4-6',
    'claude-haiku-4-5-20251001',
    'claude-3-5-sonnet-20241022',
    'claude-3-opus-20240229'
  ],
  google: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
  xai: ['grok-3', 'grok-3-mini', 'grok-2'],
  openrouter: ['openai/gpt-4o', 'anthropic/claude-3.5-sonnet', 'meta-llama/llama-3.3-70b-instruct'],
  ollama: ['llama3.3', 'codellama', 'mistral', 'deepseek-coder']
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
    openai: { provider: 'openai', model: 'gpt-4o' },
    anthropic: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
    google: { provider: 'google', model: 'gemini-2.0-flash' },
    groq: { provider: 'groq', model: 'llama-3.3-70b-versatile' },
    xai: { provider: 'xai', model: 'grok-3', baseUrl: 'https://api.x.ai/v1' },
    openrouter: {
      provider: 'openrouter',
      model: 'openai/gpt-4o',
      baseUrl: 'https://openrouter.ai/api/v1'
    },
    ollama: { provider: 'ollama', model: 'llama3.3', baseUrl: 'http://localhost:11434' }
  }
}
