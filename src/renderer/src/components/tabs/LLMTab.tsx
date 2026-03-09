import React, { useState } from 'react'
import Editor from '@monaco-editor/react'
import type { ComfyNodeDef } from '../../types/node.types'
import { useProjectStore } from '../../store/projectStore'
import { useSettingsStore } from '../../store/settingsStore'
import { Button } from '../ui/button'
import { Textarea } from '../ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { buildLLMSystemPrompt } from '../../../../main/generators/codeGenerator'
import { PROVIDER_LABELS, DEFAULT_MODELS } from '../../types/llm.types'
import { Loader2, Wand2, Check, RefreshCw, Settings, AlertCircle } from 'lucide-react'
import { cn } from '../../lib/utils'

interface LLMTabProps {
  node: ComfyNodeDef
}

export function LLMTab({ node }: LLMTabProps): JSX.Element {
  const { updateNode } = useProjectStore()
  const { llm, setActiveProvider, setProviderModel } = useSettingsStore()

  const [prompt, setPrompt] = useState('')
  const [generatedCode, setGeneratedCode] = useState(node.executeBody || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [appliedSuccess, setAppliedSuccess] = useState(false)

  const activeConfig = llm.providers[llm.activeProvider]

  async function handleGenerate(): Promise<void> {
    if (!prompt.trim()) return
    setLoading(true)
    setError(null)
    try {
      const systemPrompt = buildLLMSystemPrompt(node)
      const result = await window.electronAPI.generateLLM({
        provider: llm.activeProvider,
        model: activeConfig.model,
        baseUrl: activeConfig.baseUrl,
        systemPrompt,
        userPrompt: prompt
      })
      setGeneratedCode(result)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  function handleApply(): void {
    updateNode(node.id, { executeBody: generatedCode })
    setAppliedSuccess(true)
    setTimeout(() => setAppliedSuccess(false), 2000)
  }

  return (
    <div className="flex h-full flex-col gap-0">
      {/* Top: Provider + Prompt */}
      <div className="border-b border-slate-700/50 bg-slate-900/30 p-4 space-y-3">
        <div className="flex items-center gap-2">
          {/* Provider selector */}
          <div className="flex-1">
            <label className="text-xs text-slate-400 mb-1 block">Provider</label>
            <Select
              value={llm.activeProvider}
              onValueChange={(v) => setActiveProvider(v as any)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PROVIDER_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Model selector */}
          <div className="flex-1">
            <label className="text-xs text-slate-400 mb-1 block">Model</label>
            <Select
              value={activeConfig.model}
              onValueChange={(m) => setProviderModel(llm.activeProvider, m)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEFAULT_MODELS[llm.activeProvider].map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Prompt */}
        <div>
          <label className="text-xs text-slate-400 mb-1 block">
            Describe what this node should do
          </label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={`E.g. "Blend two images together using alpha compositing. The blend_factor input (0.0–1.0) controls how much of each image shows."`}
            className="resize-none h-20 text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                handleGenerate()
              }
            }}
          />
          <p className="text-xs text-slate-600 mt-1">Ctrl+Enter to generate</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            className="gap-2"
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            {loading ? 'Generating…' : 'Generate'}
          </Button>

          {generatedCode && !loading && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={handleGenerate}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Regenerate
            </Button>
          )}

          {error && (
            <p className="flex items-center gap-1.5 text-xs text-red-400">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          )}
        </div>
      </div>

      {/* Bottom: Generated code editor */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700/50 bg-slate-900/20">
          <div>
            <span className="text-xs font-semibold text-slate-300">execute() body</span>
            <span className="ml-2 text-xs text-slate-600">— edit freely, then click Apply</span>
          </div>
          <Button
            size="sm"
            className={cn('h-7 gap-1.5 text-xs transition-colors', appliedSuccess && 'bg-green-600 hover:bg-green-700')}
            onClick={handleApply}
            disabled={!generatedCode}
          >
            {appliedSuccess ? (
              <><Check className="h-3.5 w-3.5" /> Applied</>
            ) : (
              'Apply to Node'
            )}
          </Button>
        </div>

        <div className="flex-1 overflow-hidden">
          {!generatedCode ? (
            <div className="flex items-center justify-center h-full text-center px-8">
              <div className="space-y-2">
                <Wand2 className="mx-auto h-8 w-8 text-slate-700" />
                <p className="text-sm text-slate-500">
                  Describe what this node should do above, then click Generate.
                </p>
                <p className="text-xs text-slate-600">
                  The LLM will write the <code className="font-mono">execute()</code> method body based on your node's inputs/outputs and description.
                </p>
              </div>
            </div>
          ) : (
            <Editor
              height="100%"
              language="python"
              theme="vs-dark"
              value={generatedCode}
              onChange={(val) => setGeneratedCode(val ?? '')}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'on',
                wordWrap: 'on',
                scrollBeyondLastLine: false,
                tabSize: 4,
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace"
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
