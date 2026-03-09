import React, { useState, useEffect } from 'react'
import { useSettingsStore } from '../../store/settingsStore'
import type { LLMProvider } from '../../types/llm.types'
import { PROVIDER_LABELS, DEFAULT_MODELS } from '../../types/llm.types'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs'
import { CheckCircle2, XCircle, Loader2, Eye, EyeOff, RefreshCw } from 'lucide-react'
import { cn } from '../../lib/utils'

const PROVIDERS: LLMProvider[] = ['openai', 'anthropic', 'google', 'groq', 'xai', 'openrouter', 'ollama']

export function SettingsTab(): JSX.Element {
  const { llm, setProviderModel, setProviderBaseUrl, ollamaModels, fetchOllamaModels, customInstructions, setCustomInstructions } = useSettingsStore()
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({})
  const [keyStatus, setKeyStatus] = useState<Record<string, boolean>>({})
  const [showKey, setShowKey] = useState<Record<string, boolean>>({})
  const [testing, setTesting] = useState<Record<string, boolean>>({})
  const [testResult, setTestResult] = useState<Record<string, boolean | null>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [fetchingModels, setFetchingModels] = useState(false)

  useEffect(() => {
    window.electronAPI.getApiKeyStatus().then((status: Record<string, boolean>) => {
      setKeyStatus(status)
    })
  }, [])

  async function handleSaveApiKey(provider: LLMProvider): Promise<void> {
    const key = apiKeys[provider] ?? ''
    setSaving((s) => ({ ...s, [provider]: true }))
    try {
      await window.electronAPI.saveApiKey(provider, key)
      setKeyStatus((s) => ({ ...s, [provider]: !!key }))
      setApiKeys((k) => ({ ...k, [provider]: '' }))
    } finally {
      setSaving((s) => ({ ...s, [provider]: false }))
    }
  }

  async function handleTest(provider: LLMProvider): Promise<void> {
    setTesting((t) => ({ ...t, [provider]: true }))
    setTestResult((r) => ({ ...r, [provider]: null }))
    try {
      const config = llm.providers[provider]
      const ok = await window.electronAPI.testConnection(provider, config.model, config.baseUrl)
      setTestResult((r) => ({ ...r, [provider]: ok }))
    } catch {
      setTestResult((r) => ({ ...r, [provider]: false }))
    } finally {
      setTesting((t) => ({ ...t, [provider]: false }))
    }
  }

  async function handleFetchOllamaModels(): Promise<void> {
    setFetchingModels(true)
    try {
      await fetchOllamaModels()
    } catch (e) {
      alert(`Could not fetch Ollama models: ${(e as Error).message}`)
    } finally {
      setFetchingModels(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-200">Settings</h2>
          <p className="text-xs text-muted-foreground mt-1">
            API keys are encrypted and stored locally on your machine. They never leave the app.
          </p>
        </div>

        <Tabs defaultValue="openai">
          <TabsList className="w-full grid grid-cols-4 h-auto flex-wrap gap-1 bg-slate-800">
            {PROVIDERS.map((p) => (
              <TabsTrigger
                key={p}
                value={p}
                className="text-xs py-1.5 data-[state=active]:bg-slate-700"
              >
                <span className="flex items-center gap-1.5">
                  {keyStatus[p] && <span className="h-1.5 w-1.5 rounded-full bg-green-400 shrink-0" />}
                  {PROVIDER_LABELS[p].split(' ')[0]}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          {PROVIDERS.map((provider) => {
            const config = llm.providers[provider]
            const models = provider === 'ollama' ? ollamaModels : DEFAULT_MODELS[provider]
            const uniqueModels = [...new Set(models)]

            return (
              <TabsContent key={provider} value={provider} className="space-y-4 pt-3">
                <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-slate-200">{PROVIDER_LABELS[provider]}</h3>

                  {/* API Key (not for Ollama) */}
                  {provider !== 'ollama' && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-400">API Key</Label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            type={showKey[provider] ? 'text' : 'password'}
                            value={apiKeys[provider] ?? ''}
                            onChange={(e) => setApiKeys((k) => ({ ...k, [provider]: e.target.value }))}
                            placeholder={keyStatus[provider] ? '••••••••••••••••••••• (saved)' : 'Enter API key…'}
                            className="pr-8 font-mono text-sm"
                          />
                          <button
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                            onClick={() => setShowKey((s) => ({ ...s, [provider]: !s[provider] }))}
                          >
                            {showKey[provider] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="shrink-0"
                          onClick={() => handleSaveApiKey(provider)}
                          disabled={saving[provider] || !apiKeys[provider]}
                        >
                          {saving[provider] ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                        </Button>
                      </div>
                      {keyStatus[provider] && (
                        <p className="text-xs text-green-400 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          API key saved — enter a new key above to replace it
                        </p>
                      )}
                    </div>
                  )}

                  {/* Base URL (Ollama / OpenRouter / xAI) */}
                  {(provider === 'ollama' || provider === 'openrouter' || provider === 'xai') && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-400">Base URL</Label>
                      <div className="flex gap-2">
                        <Input
                          value={config.baseUrl ?? ''}
                          onChange={(e) => setProviderBaseUrl(provider, e.target.value)}
                          placeholder={
                            provider === 'ollama'
                              ? 'http://localhost:11434'
                              : provider === 'openrouter'
                                ? 'https://openrouter.ai/api/v1'
                                : 'https://api.x.ai/v1'
                          }
                          className="font-mono text-sm"
                        />
                        {provider === 'ollama' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="shrink-0 gap-1.5"
                            onClick={handleFetchOllamaModels}
                            disabled={fetchingModels}
                          >
                            {fetchingModels ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                            Fetch Models
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Model selector */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-400">Model</Label>
                    <div className="flex gap-2">
                      <Input
                        value={config.model}
                        onChange={(e) => setProviderModel(provider, e.target.value)}
                        className="font-mono text-sm flex-1"
                        placeholder="Enter model name"
                        list={`models-${provider}`}
                      />
                      <datalist id={`models-${provider}`}>
                        {uniqueModels.map((m) => (
                          <option key={m} value={m} />
                        ))}
                      </datalist>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {uniqueModels.slice(0, 5).map((m) => (
                        <button
                          key={m}
                          className={cn(
                            'px-2 py-0.5 rounded text-xs border transition-colors',
                            config.model === m
                              ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                              : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                          )}
                          onClick={() => setProviderModel(provider, m)}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Test connection */}
                  <div className="flex items-center gap-3 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 border-slate-700"
                      onClick={() => handleTest(provider)}
                      disabled={testing[provider] || (provider !== 'ollama' && !keyStatus[provider])}
                    >
                      {testing[provider] ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Test Connection'
                      )}
                    </Button>
                    {testResult[provider] === true && (
                      <span className="flex items-center gap-1 text-xs text-green-400">
                        <CheckCircle2 className="h-4 w-4" /> Connected successfully
                      </span>
                    )}
                    {testResult[provider] === false && (
                      <span className="flex items-center gap-1 text-xs text-red-400">
                        <XCircle className="h-4 w-4" /> Connection failed — check key and model
                      </span>
                    )}
                  </div>
                </div>
              </TabsContent>
            )
          })}
        </Tabs>

        {/* Custom AI Instructions */}
        <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-4 space-y-2">
          <Label className="text-sm font-semibold text-slate-200">Custom AI Instructions</Label>
          <p className="text-xs text-muted-foreground">
            This text is appended to the system prompt for all AI generations. Use it to guide the AI's coding style or add project-specific context.
          </p>
          <Textarea
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
            placeholder="E.g. Always use numpy for array operations. Prefer explicit error handling over silent failures."
            className="resize-none h-24 text-sm font-mono"
          />
        </div>
      </div>
    </div>
  )
}
