import React, { useState, useEffect } from 'react'
import { useSettingsStore } from '../../store/settingsStore'
import { useSelectedNode } from '../../store/projectStore'
import type { LLMProvider } from '../../types/llm.types'
import { PROVIDER_LABELS, DEFAULT_MODELS } from '../../types/llm.types'
import { COMFY_TYPE_INFO } from '../../lib/comfyTypes'
import { buildLLMSystemPrompt } from '../../../../main/generators/codeGenerator'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { Switch } from '../ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { CheckCircle2, XCircle, Loader2, Eye, EyeOff, RefreshCw, X, Plus, ChevronDown, ChevronRight, Star } from 'lucide-react'
import { cn } from '../../lib/utils'

const PROVIDERS: LLMProvider[] = ['openai', 'anthropic', 'google', 'groq', 'xai', 'minimax', 'openrouter', 'ollama']

type SettingsSubTab = 'general' | 'color' | 'ai' | 'prompts'

const SUB_TAB_LABELS: Record<SettingsSubTab, string> = {
  general: 'General',
  color: 'Color',
  ai: 'AI Providers',
  prompts: 'Prompts',
}

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
          {(['general', 'color', 'ai', 'prompts'] as SettingsSubTab[]).map((tab) => (
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
              {SUB_TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        {subTab === 'general' && <GeneralSubTab />}
        {subTab === 'color' && <ColorSubTab />}
        {subTab === 'ai' && <AIAssistantSubTab />}
        {subTab === 'prompts' && <PromptsSubTab />}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// General sub-tab — only Recent Projects
// ---------------------------------------------------------------------------

function GeneralSubTab(): JSX.Element {
  const {
    recentProjects,
    recentProjectsEnabled,
    maxRecentProjects,
    setRecentProjectsEnabled,
    setMaxRecentProjects,
    clearRecentProjects
  } = useSettingsStore()

  return (
    <div className="space-y-6">
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
      {/* Native color picker — dark color scheme so the picker dialog renders dark */}
      <input
        type="color"
        value={effectiveHex}
        onChange={(e) => handleHexChange(e.target.value)}
        className="h-7 w-10 shrink-0 cursor-pointer rounded border border-slate-600 bg-transparent p-0.5"
        style={{ colorScheme: 'dark' }}
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
    llm,
    setProviderModel,
    setProviderBaseUrl,
    ollamaModels,
    fetchOllamaModels,
    groqModels,
    fetchGroqModels,
    customModels,
    addCustomModel,
    removeCustomModel,
    favoriteModels,
    toggleFavoriteModel,
    customInstructions,
    setCustomInstructions,
    instructionScope,
    setInstructionScope,
    providerInstructions,
    setProviderInstruction,
    modelInstructions,
    setModelInstruction,
    contextMessageCount,
    setContextMessageCount
  } = useSettingsStore()

  const selectedNode = useSelectedNode()

  // Provider config state
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({})
  const [keyStatus, setKeyStatus] = useState<Record<string, boolean>>({})
  const [showKey, setShowKey] = useState<Record<string, boolean>>({})
  const [testing, setTesting] = useState<Record<string, boolean>>({})
  const [testResult, setTestResult] = useState<Record<string, boolean | null>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [fetchingModels, setFetchingModels] = useState(false)
  const [fetchingGroqModels, setFetchingGroqModels] = useState(false)
  const [newModelInput, setNewModelInput] = useState<Record<string, string>>({})
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; provider: LLMProvider; model: string } | null>(null)

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

  async function handleFetchGroqModels(): Promise<void> {
    setFetchingGroqModels(true)
    try {
      await fetchGroqModels()
    } catch (e) {
      alert(`Could not fetch Groq models: ${(e as Error).message}`)
    } finally {
      setFetchingGroqModels(false)
    }
  }

  // Close context menu on any click
  useEffect(() => {
    if (!contextMenu) return
    const close = (): void => setContextMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('contextmenu', close)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('contextmenu', close)
    }
  }, [contextMenu])

  return (
    <div className="space-y-6">
      {/* ================================================================
          Section 1: AI Providers
          ================================================================ */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">AI Providers</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Configure API keys and models for each provider.</p>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <Star className="h-3 w-3 text-yellow-500/70 shrink-0" />
            Right-click any model pill to add or remove it from your favorites.
          </p>
        </div>
        {PROVIDERS.map((provider) => {
          const config = llm.providers[provider]
          const baseModels = provider === 'ollama'
            ? ollamaModels
            : provider === 'groq' && groqModels.length > 0
              ? groqModels
              : DEFAULT_MODELS[provider]
          const userModels = customModels[provider] ?? []
          const allModels = [...new Set([...baseModels, ...userModels])]

          return (
            <div key={provider} className="rounded-lg border border-slate-700 bg-slate-800/30 p-4 space-y-3">
              <div className="flex items-center gap-2">
                {keyStatus[provider] && <span className="h-2 w-2 rounded-full bg-green-400 shrink-0" />}
                <h3 className="text-sm font-semibold text-slate-200">{PROVIDER_LABELS[provider]}</h3>
                {provider === 'groq' && keyStatus[provider] && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-7 gap-1.5 text-xs text-slate-400 hover:text-slate-200"
                    onClick={handleFetchGroqModels}
                    disabled={fetchingGroqModels}
                    title="Fetch available models from Groq API"
                  >
                    {fetchingGroqModels ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    Fetch Models
                  </Button>
                )}
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

              {/* Base URL (Ollama / OpenRouter / xAI / MiniMax) */}
              {(provider === 'ollama' || provider === 'openrouter' || provider === 'xai' || provider === 'minimax') && (
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
                            : provider === 'minimax'
                              ? 'https://api.minimax.io/v1'
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
                {allModels.length > 0 && (() => {
                  const provFavs = favoriteModels[provider] ?? []
                  const favs = allModels.filter((m) => provFavs.includes(m))
                  const others = allModels.filter((m) => !provFavs.includes(m))
                  const renderPill = (m: string, isFav: boolean): JSX.Element => {
                    const isCustom = userModels.includes(m)
                    const isActive = config.model === m
                    return (
                      <div key={m} className="flex items-center gap-0">
                        <button
                          className={cn(
                            'flex items-center gap-1 px-2 py-0.5 text-xs border transition-colors',
                            isCustom ? 'rounded-l' : 'rounded',
                            isFav && isActive && 'bg-yellow-600/20 border-yellow-500 text-yellow-300',
                            isFav && !isActive && 'border-yellow-700/60 text-yellow-400 hover:border-yellow-500 hover:text-yellow-300',
                            !isFav && isActive && 'bg-blue-600/30 border-blue-500 text-blue-300',
                            !isFav && !isActive && 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                          )}
                          onClick={() => setProviderModel(provider, m)}
                          onContextMenu={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setContextMenu({ x: e.clientX, y: e.clientY, provider, model: m })
                          }}
                          title="Right-click to favorite"
                        >
                          {isFav && <Star className="h-2.5 w-2.5 fill-yellow-400 text-yellow-400 shrink-0" />}
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
                  }
                  return (
                    <div className="space-y-1.5">
                      {favs.length > 0 && (
                        <div>
                          <p className="text-[10px] text-yellow-600 uppercase tracking-wide mb-1">Favorites</p>
                          <div className="flex flex-wrap gap-1">{favs.map((m) => renderPill(m, true))}</div>
                        </div>
                      )}
                      {others.length > 0 && (
                        <div>
                          {favs.length > 0 && <p className="text-[10px] text-slate-600 uppercase tracking-wide mb-1">Others</p>}
                          <div className="flex flex-wrap gap-1">{others.map((m) => renderPill(m, false))}</div>
                        </div>
                      )}
                    </div>
                  )
                })()}
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

      {/* Context menu for favoriting models */}
      {contextMenu && (
        <div
          className="fixed z-50 min-w-[160px] rounded-md border border-slate-700 bg-slate-900 shadow-lg py-1 text-xs"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-slate-800 transition-colors"
            onClick={() => { toggleFavoriteModel(contextMenu.provider, contextMenu.model); setContextMenu(null) }}
          >
            {(favoriteModels[contextMenu.provider] ?? []).includes(contextMenu.model) ? (
              <><Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" /> Remove from Favorites</>
            ) : (
              <><Star className="h-3.5 w-3.5 text-yellow-400" /> Add to Favorites</>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Prompts sub-tab — system prompt instructions + context history
// ---------------------------------------------------------------------------

function PromptsSubTab(): JSX.Element {
  const {
    llm,
    customInstructions,
    setCustomInstructions,
    instructionScope,
    setInstructionScope,
    providerInstructions,
    setProviderInstruction,
    modelInstructions,
    setModelInstruction,
    contextMessageCount,
    setContextMessageCount,
    ollamaModels,
    groqModels,
    customModels,
  } = useSettingsStore()

  const selectedNode = useSelectedNode()
  const [systemPromptOpen, setSystemPromptOpen] = useState(false)
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set())
  const [newModelProvider, setNewModelProvider] = useState<LLMProvider>(llm.activeProvider)
  const [newModelName, setNewModelName] = useState('')

  function toggleProviderExpand(provider: string): void {
    setExpandedProviders((prev) => {
      const next = new Set(prev)
      if (next.has(provider)) next.delete(provider)
      else next.add(provider)
      return next
    })
  }

  function getModelsForProvider(provider: LLMProvider): string[] {
    let base: string[]
    if (provider === 'ollama') base = ollamaModels
    else if (provider === 'groq') base = groqModels.length > 0 ? groqModels : DEFAULT_MODELS.groq
    else base = DEFAULT_MODELS[provider]
    const custom = customModels[provider] ?? []
    return [...new Set([...base, ...custom])]
  }

  function handleAddModelInstruction(): void {
    const key = `${newModelProvider}:${newModelName.trim()}`
    if (!newModelName.trim()) return
    setModelInstruction(key, '')
    setNewModelName('')
  }

  return (
    <div className="space-y-6">
      {/* ================================================================
          System Prompt
          ================================================================ */}
      <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-4 space-y-4">
        <div>
          <Label className="text-sm font-semibold text-slate-200">System Prompt</Label>
          <p className="text-xs text-muted-foreground mt-1">
            Configure the instructions sent to the AI. Leave a field empty to use the auto-generated node context prompt. When filled, your text is appended to the auto-generated prompt.
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
            <Label className="text-xs text-slate-400">Global additions (appended to all requests)</Label>
            <Textarea
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="E.g. Always use numpy for array operations. Prefer explicit error handling over silent failures."
              className="resize-none h-24 text-sm font-mono"
            />
          </div>
        )}

        {/* Per-provider scope — accordion */}
        {instructionScope === 'provider' && (
          <div className="space-y-2">
            {PROVIDERS.map((provider) => {
              const isExpanded = expandedProviders.has(provider)
              const text = providerInstructions[provider] ?? ''
              const hasContent = text.trim().length > 0
              return (
                <div key={provider} className="rounded border border-slate-700/60 bg-slate-900/30">
                  <button
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-left hover:bg-slate-800/40 transition-colors"
                    onClick={() => toggleProviderExpand(provider)}
                  >
                    {isExpanded ? <ChevronDown className="h-3 w-3 shrink-0 text-slate-500" /> : <ChevronRight className="h-3 w-3 shrink-0 text-slate-500" />}
                    <span className="flex-1 font-medium text-slate-300">{PROVIDER_LABELS[provider]}</span>
                    {hasContent && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-400 border border-blue-800/40">set</span>
                    )}
                  </button>
                  {isExpanded && (
                    <div className="px-3 pb-3">
                      <Textarea
                        value={text}
                        onChange={(e) => setProviderInstruction(provider, e.target.value)}
                        placeholder={`Custom instructions for ${PROVIDER_LABELS[provider]}…`}
                        className="resize-none h-16 text-sm font-mono"
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Per-model scope — form + cards */}
        {instructionScope === 'model' && (
          <div className="space-y-3">
            <div className="flex gap-2 items-end">
              <div className="space-y-1">
                <Label className="text-xs text-slate-400">Provider</Label>
                <Select value={newModelProvider} onValueChange={(v) => setNewModelProvider(v as LLMProvider)}>
                  <SelectTrigger className="h-8 text-xs w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map((p) => (
                      <SelectItem key={p} value={p}>{PROVIDER_LABELS[p]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 flex-1">
                <Label className="text-xs text-slate-400">Model name</Label>
                <Input
                  value={newModelName}
                  onChange={(e) => setNewModelName(e.target.value)}
                  placeholder={llm.providers[newModelProvider].model || 'model-name'}
                  className="font-mono text-xs h-8"
                  list="per-model-datalist"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddModelInstruction() }}
                />
                <datalist id="per-model-datalist">
                  {getModelsForProvider(newModelProvider).map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </div>
              <Button variant="secondary" size="sm" className="h-8 gap-1 shrink-0" disabled={!newModelName.trim()} onClick={handleAddModelInstruction}>
                <Plus className="h-3 w-3" /> Add
              </Button>
            </div>

            {Object.entries(modelInstructions).length === 0 && (
              <p className="text-xs text-slate-600 italic">No per-model instructions configured yet.</p>
            )}
            {Object.entries(modelInstructions).map(([key, text]) => {
              const [providerPart, ...rest] = key.split(':')
              const modelPart = rest.join(':')
              const providerLabel = PROVIDER_LABELS[providerPart as LLMProvider] ?? providerPart
              return (
                <div key={key} className="rounded border border-slate-700/60 bg-slate-900/30">
                  <div className="flex items-center gap-2 px-3 py-2">
                    <span className="flex-1 text-xs font-medium text-slate-300">
                      <span className="text-slate-500">{providerLabel}:</span> <span className="font-mono text-slate-200">{modelPart}</span>
                    </span>
                    <button className="text-slate-500 hover:text-red-400 transition-colors" onClick={() => setModelInstruction(key, '')} title="Remove">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="px-3 pb-3">
                    <Textarea value={text} onChange={(e) => setModelInstruction(key, e.target.value)} placeholder={`Custom instructions for ${key}…`} className="resize-none h-16 text-sm font-mono" />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* System Prompt Preview */}
        <div className="rounded-lg border border-slate-700/50 bg-slate-900/20">
          <button className="flex items-center gap-1.5 px-4 py-3 text-xs text-slate-400 hover:text-slate-200 w-full text-left font-medium" onClick={() => setSystemPromptOpen(!systemPromptOpen)}>
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

      {/* ================================================================
          Context History
          ================================================================ */}
      <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-4 space-y-3">
        <Label className="text-sm font-semibold text-slate-200">Context History</Label>
        <p className="text-xs text-muted-foreground">How many recent messages to include in each AI request for multi-turn context.</p>
        <div className="flex items-center gap-3">
          <Input
            type="number" min={0} max={50}
            value={contextMessageCount}
            onChange={(e) => { const n = parseInt(e.target.value, 10); if (!isNaN(n) && n >= 0 && n <= 50) setContextMessageCount(n) }}
            className="w-20"
          />
          <span className="text-xs text-slate-500">messages (0 = current message only)</span>
        </div>
      </div>
    </div>
  )
}
