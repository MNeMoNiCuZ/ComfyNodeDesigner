import React, { useState, useEffect } from 'react'
import { useSettingsStore } from '../../store/settingsStore'
import { useSelectedNode } from '../../store/projectStore'
import type { LLMProvider } from '../../types/llm.types'
import { PROVIDER_LABELS, DEFAULT_MODELS } from '../../types/llm.types'
import { COMFY_TYPE_INFO, getTypeHex } from '../../lib/comfyTypes'
import type { ComfyType } from '../../types/node.types'
import { buildLLMSystemPrompt } from '../../../../main/generators/codeGenerator'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { Switch } from '../ui/switch'
import { CheckCircle2, XCircle, Loader2, Eye, EyeOff, RefreshCw, X, Plus, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'

const PROVIDERS: LLMProvider[] = ['openai', 'anthropic', 'google', 'groq', 'xai', 'openrouter', 'ollama']

type SettingsSubTab = 'general' | 'color' | 'ai'

export function SettingsTab(): JSX.Element {
  const [subTab, setSubTab] = useState<SettingsSubTab>('general')

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-200">Settings</h2>
          <p className="text-xs text-muted-foreground mt-1">
            API keys are encrypted and stored locally on your machine. They never leave the app.
          </p>
        </div>

        {/* Sub-tab bar */}
        <div className="flex gap-1 border-b border-slate-700/50 pb-0">
          {(['general', 'color', 'ai'] as SettingsSubTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setSubTab(tab)}
              className={cn(
                'px-4 py-2 text-sm rounded-t-md border-b-2 transition-colors',
                subTab === tab
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              )}
            >
              {tab === 'general' ? 'General' : tab === 'color' ? 'Color' : 'AI Assistant'}
            </button>
          ))}
        </div>

        {subTab === 'general' && <GeneralSubTab />}
        {subTab === 'color' && <ColorSubTab />}
        {subTab === 'ai' && <AIAssistantSubTab />}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// General sub-tab
// ---------------------------------------------------------------------------

function GeneralSubTab(): JSX.Element {
  const {
    llm,
    setProviderModel,
    setProviderBaseUrl,
    ollamaModels,
    fetchOllamaModels,
    recentProjects,
    recentProjectsEnabled,
    maxRecentProjects,
    setRecentProjectsEnabled,
    setMaxRecentProjects,
    clearRecentProjects,
    customModels,
    addCustomModel,
    removeCustomModel
  } = useSettingsStore()
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({})
  const [keyStatus, setKeyStatus] = useState<Record<string, boolean>>({})
  const [showKey, setShowKey] = useState<Record<string, boolean>>({})
  const [testing, setTesting] = useState<Record<string, boolean>>({})
  const [testResult, setTestResult] = useState<Record<string, boolean | null>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [fetchingModels, setFetchingModels] = useState(false)
  const [newModelInput, setNewModelInput] = useState<Record<string, string>>({})

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
    <div className="space-y-6">
      {/* Provider tabs */}
      <div className="space-y-4">
        {PROVIDERS.map((provider) => {
          const config = llm.providers[provider]
          const baseModels = provider === 'ollama' ? ollamaModels : DEFAULT_MODELS[provider]
          const userModels = customModels[provider] ?? []
          const allModels = [...new Set([...baseModels, ...userModels])]

          return (
            <div key={provider} className="rounded-lg border border-slate-700 bg-slate-800/30 p-4 space-y-3">
              <div className="flex items-center gap-2">
                {keyStatus[provider] && <span className="h-2 w-2 rounded-full bg-green-400 shrink-0" />}
                <h3 className="text-sm font-semibold text-slate-200">{PROVIDER_LABELS[provider]}</h3>
              </div>

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
                    {allModels.map((m) => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                </div>
                {allModels.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {allModels.map((m) => {
                      const isCustom = userModels.includes(m)
                      return (
                        <div key={m} className="flex items-center gap-0">
                          <button
                            className={cn(
                              'px-2 py-0.5 text-xs border transition-colors',
                              isCustom ? 'rounded-l' : 'rounded',
                              config.model === m
                                ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                                : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                            )}
                            onClick={() => setProviderModel(provider, m)}
                          >
                            {m}
                          </button>
                          {isCustom && (
                            <button
                              className="px-1 py-0.5 rounded-r text-xs border border-l-0 border-slate-700 text-slate-500 hover:text-red-400 hover:border-red-800 transition-colors"
                              onClick={() => removeCustomModel(provider, m)}
                              title="Remove custom model"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
                {/* Add custom model */}
                <div className="flex gap-2 pt-1">
                  <Input
                    value={newModelInput[provider] ?? ''}
                    onChange={(e) => setNewModelInput((s) => ({ ...s, [provider]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        addCustomModel(provider, newModelInput[provider] ?? '')
                        setNewModelInput((s) => ({ ...s, [provider]: '' }))
                      }
                    }}
                    placeholder="Add custom model name…"
                    className="font-mono text-xs h-7 flex-1"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-7 px-2 shrink-0 gap-1"
                    disabled={!(newModelInput[provider] ?? '').trim()}
                    onClick={() => {
                      addCustomModel(provider, newModelInput[provider] ?? '')
                      setNewModelInput((s) => ({ ...s, [provider]: '' }))
                    }}
                  >
                    <Plus className="h-3 w-3" /> Add
                  </Button>
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
          )
        })}
      </div>

      {/* Recent Projects */}
      <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-4 space-y-3">
        <Label className="text-sm font-semibold text-slate-200">Recent Projects</Label>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">Enable recent projects history</span>
          <Switch
            checked={recentProjectsEnabled}
            onCheckedChange={setRecentProjectsEnabled}
          />
        </div>
        {recentProjectsEnabled && (
          <>
            <div className="flex items-center gap-3">
              <Label className="text-xs text-slate-400 shrink-0">Max history count</Label>
              <Input
                type="number"
                min={10}
                max={100}
                step={10}
                value={maxRecentProjects}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10)
                  if (!isNaN(n) && n >= 10 && n <= 100) setMaxRecentProjects(n)
                }}
                className="w-20 text-sm"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {recentProjects.length} project{recentProjects.length !== 1 ? 's' : ''} in history
              </span>
              <Button
                variant="outline"
                size="sm"
                className="border-slate-700 text-xs"
                onClick={clearRecentProjects}
                disabled={recentProjects.length === 0}
              >
                Clear History
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Color sub-tab
// ---------------------------------------------------------------------------

function ColorSwatchRow({ typeInfo }: { typeInfo: typeof COMFY_TYPE_INFO[number] }): JSX.Element {
  const { typeColorOverrides, setTypeColorOverride, resetTypeColorOverride } = useSettingsStore()
  const overriddenHex = typeColorOverrides[typeInfo.type]
  const effectiveHex = overriddenHex ?? typeInfo.hex
  const [inputValue, setInputValue] = useState(effectiveHex)

  useEffect(() => {
    setInputValue(overriddenHex ?? typeInfo.hex)
  }, [overriddenHex, typeInfo.hex])

  function handleHexChange(val: string): void {
    setInputValue(val)
    // Only apply if it looks like a valid hex color
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      setTypeColorOverride(typeInfo.type, val)
    }
  }

  return (
    <div className="flex items-center gap-3 py-1.5 border-b border-slate-700/30 last:border-0">
      {/* Color swatch */}
      <div
        className="h-5 w-5 rounded shrink-0 border border-slate-600"
        style={{ backgroundColor: effectiveHex }}
      />
      {/* Type label */}
      <span className="text-xs font-mono text-slate-300 w-36 shrink-0">{typeInfo.label}</span>
      {/* Type key */}
      <span className="text-[10px] font-mono text-slate-500 w-28 shrink-0">{typeInfo.type}</span>
      {/* Native color picker */}
      <input
        type="color"
        value={effectiveHex}
        onChange={(e) => handleHexChange(e.target.value)}
        className="h-7 w-10 shrink-0 cursor-pointer rounded border border-slate-600 bg-transparent p-0.5"
        title="Pick color"
      />
      {/* Hex input */}
      <Input
        value={inputValue}
        onChange={(e) => handleHexChange(e.target.value)}
        className="font-mono text-xs h-7 w-28 shrink-0"
        placeholder="#RRGGBB"
        maxLength={7}
      />
      {/* Reset button */}
      {overriddenHex && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-slate-400 hover:text-slate-200"
          onClick={() => resetTypeColorOverride(typeInfo.type)}
          title="Reset to default"
        >
          Reset
        </Button>
      )}
    </div>
  )
}

function ColorSubTab(): JSX.Element {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-4">
        <Label className="text-sm font-semibold text-slate-200 block mb-1">Type Colors</Label>
        <p className="text-xs text-muted-foreground mb-4">
          Customize the connector dot colors used in the node preview. Changes affect the Preview tab only — badge colors use fixed Tailwind classes.
        </p>
        <div>
          {COMFY_TYPE_INFO.map((typeInfo) => (
            <ColorSwatchRow key={typeInfo.type} typeInfo={typeInfo} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AI Assistant sub-tab
// ---------------------------------------------------------------------------

function AIAssistantSubTab(): JSX.Element {
  const {
    customInstructions,
    setCustomInstructions,
    instructionScope,
    setInstructionScope,
    providerInstructions,
    setProviderInstruction,
    modelInstructions,
    setModelInstruction,
    llm,
    contextMessageCount,
    setContextMessageCount
  } = useSettingsStore()
  const selectedNode = useSelectedNode()
  const [newModelKey, setNewModelKey] = useState('')
  const [systemPromptOpen, setSystemPromptOpen] = useState(false)

  return (
    <div className="space-y-4">
      {/* Context History */}
      <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-4 space-y-3">
        <Label className="text-sm font-semibold text-slate-200">Context History</Label>
        <p className="text-xs text-muted-foreground">How many recent messages to include in each AI request for multi-turn context.</p>
        <div className="flex items-center gap-3">
          <Input
            type="number"
            min={0}
            max={50}
            value={contextMessageCount}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10)
              if (!isNaN(n) && n >= 0 && n <= 50) setContextMessageCount(n)
            }}
            className="w-20"
          />
          <span className="text-xs text-slate-500">messages (0 = current message only)</span>
        </div>
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-4 space-y-4">
        <div>
          <Label className="text-sm font-semibold text-slate-200">Custom AI Instructions</Label>
          <p className="text-xs text-muted-foreground mt-1">
            Appended to the system prompt for AI generations.
          </p>
        </div>

        {/* Scope selector */}
        <div className="space-y-2">
          <Label className="text-xs text-slate-400">Instruction Scope</Label>
          <div className="flex gap-2">
            {(['global', 'provider', 'model'] as const).map((scope) => (
              <button
                key={scope}
                onClick={() => setInstructionScope(scope)}
                className={cn(
                  'px-3 py-1.5 text-xs rounded border transition-colors capitalize',
                  instructionScope === scope
                    ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                    : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                )}
              >
                {scope === 'global' ? 'Global' : scope === 'provider' ? 'Per Provider' : 'Per Model'}
              </button>
            ))}
          </div>
        </div>

        {/* Global scope */}
        {instructionScope === 'global' && (
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-400">Global Instructions</Label>
            <Textarea
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="E.g. Always use numpy for array operations. Prefer explicit error handling over silent failures."
              className="resize-none h-24 text-sm font-mono"
            />
          </div>
        )}

        {/* Per-provider scope */}
        {instructionScope === 'provider' && (
          <div className="space-y-3">
            {PROVIDERS.map((provider) => (
              <div key={provider} className="space-y-1">
                <Label className="text-xs text-slate-400">{PROVIDER_LABELS[provider]}</Label>
                <Textarea
                  value={providerInstructions[provider] ?? ''}
                  onChange={(e) => setProviderInstruction(provider, e.target.value)}
                  placeholder={`Custom instructions for ${PROVIDER_LABELS[provider]}…`}
                  className="resize-none h-16 text-sm font-mono"
                />
              </div>
            ))}
          </div>
        )}

        {/* Per-model scope */}
        {instructionScope === 'model' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              Key format: <code className="bg-slate-700 px-1 rounded">provider:model</code> — e.g. <code className="bg-slate-700 px-1 rounded">openai:gpt-4o</code>
            </p>
            {Object.entries(modelInstructions).map(([key, text]) => (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-slate-400 font-mono">{key}</Label>
                  <button
                    className="text-xs text-slate-500 hover:text-red-400"
                    onClick={() => setModelInstruction(key, '')}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <Textarea
                  value={text}
                  onChange={(e) => setModelInstruction(key, e.target.value)}
                  placeholder={`Custom instructions for ${key}…`}
                  className="resize-none h-16 text-sm font-mono"
                />
              </div>
            ))}
            {/* Add new model key */}
            <div className="flex gap-2">
              <Input
                value={newModelKey}
                onChange={(e) => setNewModelKey(e.target.value)}
                placeholder={`${llm.activeProvider}:${llm.providers[llm.activeProvider].model || 'model-name'}`}
                className="font-mono text-xs h-8 flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newModelKey.trim()) {
                    setModelInstruction(newModelKey.trim(), '')
                    setNewModelKey('')
                  }
                }}
              />
              <Button
                variant="secondary"
                size="sm"
                className="h-8 gap-1"
                disabled={!newModelKey.trim()}
                onClick={() => {
                  setModelInstruction(newModelKey.trim(), '')
                  setNewModelKey('')
                }}
              >
                <Plus className="h-3 w-3" /> Add
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* System Prompt Preview */}
      <div className="rounded-lg border border-slate-700 bg-slate-800/30">
        <button
          className="flex items-center gap-1.5 px-4 py-3 text-xs text-slate-400 hover:text-slate-200 w-full text-left font-medium"
          onClick={() => setSystemPromptOpen(!systemPromptOpen)}
        >
          {systemPromptOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          System Prompt Preview
        </button>
        {systemPromptOpen && (
          <div className="px-4 pb-4">
            {selectedNode ? (
              <pre className="text-xs text-slate-500 whitespace-pre-wrap max-h-60 overflow-y-auto bg-slate-900/50 rounded p-2 font-mono">
                {buildLLMSystemPrompt(selectedNode)}
              </pre>
            ) : (
              <p className="text-xs text-slate-600 italic">Select a node to preview the system prompt.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
