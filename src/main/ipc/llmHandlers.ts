import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import Groq from 'groq-sdk'
import type { LLMGenerateRequest, LLMProvider } from '../../renderer/src/types/llm.types'

interface LLMAdapter {
  generate(system: string, user: string, model: string): Promise<string>
  testConnection(model: string): Promise<boolean>
}

function getOpenAICompatibleAdapter(apiKey: string, baseURL?: string): LLMAdapter {
  const client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) })
  return {
    async generate(system, user, model) {
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        max_tokens: 4096
      })
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
    async generate(system, user, model) {
      const response = await client.messages.create({
        model,
        max_tokens: 4096,
        system,
        messages: [{ role: 'user', content: user }]
      })
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
  return {
    async generate(system, user, model) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
      const body = {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { maxOutputTokens: 4096 }
      }
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (!response.ok) {
        const err = await response.text()
        throw new Error(`Google API error: ${err}`)
      }
      const data = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
      }
      return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    },
    async testConnection(model) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'Reply: ok' }] }],
            generationConfig: { maxOutputTokens: 5 }
          })
        })
        return response.ok
      } catch {
        return false
      }
    }
  }
}

function getGroqAdapter(apiKey: string): LLMAdapter {
  const client = new Groq({ apiKey })
  return {
    async generate(system, user, model) {
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        max_tokens: 4096
      })
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
  return {
    async generate(system, user, model) {
      const response = await fetch(`${base}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user }
          ],
          stream: false
        })
      })
      if (!response.ok) {
        const err = await response.text()
        throw new Error(`Ollama error: ${err}`)
      }
      const data = (await response.json()) as { message?: { content?: string } }
      return data.message?.content ?? ''
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
