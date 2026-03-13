import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import Groq from 'groq-sdk'
import type { LLMGenerateRequest, LLMChatRequest, LLMProvider } from '../../renderer/src/types/llm.types'

// Abort controller registry for in-flight requests
const abortControllers = new Map<string, AbortController>()

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface LLMAdapter {
  generate(system: string, user: string, model: string, signal?: AbortSignal): Promise<string>
  generateChat(system: string, messages: ChatMessage[], model: string, signal?: AbortSignal): Promise<string>
  testConnection(model: string): Promise<boolean>
}

function getOpenAICompatibleAdapter(apiKey: string, baseURL?: string): LLMAdapter {
  const client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) })
  return {
    async generate(system, user, model, signal?) {
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        max_tokens: 4096
      }, { signal: signal as any })
      return response.choices[0]?.message?.content ?? ''
    },
    async generateChat(system, messages, model, signal?) {
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: system },
          ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
        ],
        max_tokens: 4096
      }, { signal: signal as any })
      return response.choices[0]?.message?.content ?? ''
    },
    async testConnection(model) {
      try {
        const response = await client.chat.completions.create({
          model,
          messages: [{ role: 'user', content: 'Reply with just: ok' }],
          max_tokens: 5
        })
        return !!response.choices[0]?.message?.content
      } catch {
        return false
      }
    }
  }
}

function getAnthropicAdapter(apiKey: string): LLMAdapter {
  const client = new Anthropic({ apiKey })
  return {
    async generate(system, user, model, signal?) {
      const response = await client.messages.create({
        model,
        max_tokens: 4096,
        system,
        messages: [{ role: 'user', content: user }]
      }, { signal: signal as any })
      const block = response.content[0]
      return block?.type === 'text' ? block.text : ''
    },
    async generateChat(system, messages, model, signal?) {
      const response = await client.messages.create({
        model,
        max_tokens: 4096,
        system,
        messages: messages.map((m) => ({ role: m.role, content: m.content }))
      }, { signal: signal as any })
      const block = response.content[0]
      return block?.type === 'text' ? block.text : ''
    },
    async testConnection(model) {
      try {
        const response = await client.messages.create({
          model,
          max_tokens: 5,
          messages: [{ role: 'user', content: 'Reply with: ok' }]
        })
        return response.content.length > 0
      } catch {
        return false
      }
    }
  }
}

function getGoogleAdapter(apiKey: string): LLMAdapter {
  async function googleCall(system: string, contents: Array<{ role: string; parts: Array<{ text: string }> }>, model: string, maxTokens: number, signal?: AbortSignal): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
    const body: Record<string, unknown> = {
      contents,
      generationConfig: { maxOutputTokens: maxTokens }
    }
    if (system) {
      body.systemInstruction = { parts: [{ text: system }] }
    }
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal
    })
    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Google API error: ${err}`)
    }
    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  }

  return {
    async generate(system, user, model, signal?) {
      return googleCall(system, [{ role: 'user', parts: [{ text: user }] }], model, 4096, signal)
    },
    async generateChat(system, messages, model, signal?) {
      const contents = messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }))
      return googleCall(system, contents, model, 4096, signal)
    },
    async testConnection(model) {
      try {
        await googleCall('', [{ role: 'user', parts: [{ text: 'Reply: ok' }] }], model, 5)
        return true
      } catch {
        return false
      }
    }
  }
}

function getGroqAdapter(apiKey: string): LLMAdapter {
  const client = new Groq({ apiKey })
  return {
    async generate(system, user, model, signal?) {
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        max_tokens: 4096
      }, { signal: signal as any })
      return response.choices[0]?.message?.content ?? ''
    },
    async generateChat(system, messages, model, signal?) {
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: system },
          ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
        ],
        max_tokens: 4096
      }, { signal: signal as any })
      return response.choices[0]?.message?.content ?? ''
    },
    async testConnection(model) {
      try {
        const response = await client.chat.completions.create({
          model,
          messages: [{ role: 'user', content: 'Reply: ok' }],
          max_tokens: 5
        })
        return !!response.choices[0]?.message?.content
      } catch {
        return false
      }
    }
  }
}

function getOllamaAdapter(baseUrl: string): LLMAdapter {
  const base = baseUrl.replace(/\/$/, '')
  async function ollamaChat(messages: Array<{ role: string; content: string }>, model: string, signal?: AbortSignal): Promise<string> {
    const response = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: false }),
      signal
    })
    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Ollama error: ${err}`)
    }
    const data = (await response.json()) as { message?: { content?: string } }
    return data.message?.content ?? ''
  }

  return {
    async generate(system, user, model, signal?) {
      return ollamaChat([
        { role: 'system', content: system },
        { role: 'user', content: user }
      ], model, signal)
    },
    async generateChat(system, messages, model, signal?) {
      return ollamaChat([
        { role: 'system', content: system },
        ...messages
      ], model, signal)
    },
    async testConnection(model) {
      try {
        const response = await fetch(`${base}/api/tags`)
        if (!response.ok) return false
        const data = (await response.json()) as { models?: Array<{ name: string }> }
        return Array.isArray(data.models)
      } catch {
        return false
      }
    }
  }
}

function getAdapter(req: LLMGenerateRequest, apiKey: string): LLMAdapter {
  switch (req.provider as LLMProvider) {
    case 'openai':
      return getOpenAICompatibleAdapter(apiKey)
    case 'anthropic':
      return getAnthropicAdapter(apiKey)
    case 'google':
      return getGoogleAdapter(apiKey)
    case 'groq':
      return getGroqAdapter(apiKey)
    case 'xai':
      return getOpenAICompatibleAdapter(apiKey, req.baseUrl ?? 'https://api.x.ai/v1')
    case 'openrouter':
      return getOpenAICompatibleAdapter(apiKey, req.baseUrl ?? 'https://openrouter.ai/api/v1')
    case 'ollama':
      return getOllamaAdapter(req.baseUrl ?? 'http://localhost:11434')
    default:
      throw new Error(`Unknown provider: ${req.provider}`)
  }
}

export async function handleGenerateLLM(
  req: LLMGenerateRequest,
  getApiKey: (provider: LLMProvider) => string | undefined
): Promise<string> {
  const apiKey = req.provider === 'ollama' ? '' : (getApiKey(req.provider) ?? '')
  if (req.provider !== 'ollama' && !apiKey) {
    throw new Error(`No API key configured for provider: ${req.provider}`)
  }
  const adapter = getAdapter(req, apiKey)
  return adapter.generate(req.systemPrompt, req.userPrompt, req.model)
}

export async function handleGenerateLLMChat(
  req: LLMChatRequest,
  getApiKey: (provider: LLMProvider) => string | undefined
): Promise<string> {
  const apiKey = req.provider === 'ollama' ? '' : (getApiKey(req.provider) ?? '')
  if (req.provider !== 'ollama' && !apiKey) {
    throw new Error(`No API key configured for provider: ${req.provider}`)
  }

  const controller = new AbortController()
  abortControllers.set(req.requestId, controller)

  try {
    const adapter = getAdapter(req as unknown as LLMGenerateRequest, apiKey)
    const result = await adapter.generateChat(
      req.systemPrompt,
      req.messages,
      req.model,
      controller.signal
    )
    return result
  } finally {
    abortControllers.delete(req.requestId)
  }
}

export function abortRequest(requestId: string): void {
  const controller = abortControllers.get(requestId)
  if (controller) {
    controller.abort()
    abortControllers.delete(requestId)
  }
}

export async function handleTestConnection(
  provider: LLMProvider,
  model: string,
  baseUrl: string | undefined,
  getApiKey: (provider: LLMProvider) => string | undefined
): Promise<boolean> {
  const apiKey = provider === 'ollama' ? '' : (getApiKey(provider) ?? '')
  if (provider !== 'ollama' && !apiKey) return false
  const req: LLMGenerateRequest = {
    provider,
    model,
    baseUrl,
    systemPrompt: '',
    userPrompt: 'ok'
  }
  const adapter = getAdapter(req, apiKey)
  return adapter.testConnection(model)
}

export async function handleFetchOllamaModels(baseUrl: string): Promise<string[]> {
  const base = (baseUrl ?? 'http://localhost:11434').replace(/\/$/, '')
  const response = await fetch(`${base}/api/tags`)
  if (!response.ok) throw new Error('Could not connect to Ollama')
  const data = (await response.json()) as { models?: Array<{ name: string }> }
  return (data.models ?? []).map((m) => m.name)
}

export async function handleFetchGroqModels(apiKey: string): Promise<string[]> {
  const response = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` }
  })
  if (!response.ok) throw new Error(`Groq API error: ${response.status}`)
  const data = (await response.json()) as { data?: Array<{ id: string }> }
  return (data.data ?? []).map((m) => m.id).sort()
}
