import React from 'react'
import type { ComfyNodeDef, IsChangedMode } from '../../types/node.types'
import { useProjectStore } from '../../store/projectStore'
import { Switch } from '../ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'

interface AdvancedTabProps {
  node: ComfyNodeDef
}

export function AdvancedTab({ node }: AdvancedTabProps): JSX.Element {
  const { updateNode } = useProjectStore()

  return (
    <div className="p-6 max-w-2xl space-y-0">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-slate-200">Advanced Settings</h2>
        <p className="text-sm text-slate-400 mt-1">
          These settings control how ComfyUI treats this node in the execution pipeline.
          Most nodes don't need any of these — they are for special-purpose nodes only.
        </p>
      </div>

      {/* OUTPUT_NODE */}
      <div className="py-4 border-b border-slate-800">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-slate-200">OUTPUT_NODE</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Enable this if your node produces a <strong>final result</strong> that should always run — for example,
              saving an image to disk, displaying a preview, or writing a file. Without this flag, ComfyUI may skip
              your node if nothing downstream needs its output.
            </p>
            <p className="text-xs text-slate-500">
              <strong>Use when:</strong> Your node saves files, shows previews, or has side effects that must always happen.
            </p>
          </div>
          <div className="shrink-0 pt-0.5">
            <Switch
              checked={node.isOutputNode}
              onCheckedChange={(checked) => updateNode(node.id, { isOutputNode: checked })}
            />
          </div>
        </div>
      </div>

      {/* INPUT_NODE */}
      <div className="py-4 border-b border-slate-800">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-slate-200">INPUT_NODE</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Enable this if your node receives <strong>external data</strong> — such as images uploaded from the web UI,
              file paths from a file picker, or data from an external API. This is rarely needed for custom nodes.
            </p>
            <p className="text-xs text-slate-500">
              <strong>Use when:</strong> Your node is a data source that receives input from outside the ComfyUI graph.
            </p>
          </div>
          <div className="shrink-0 pt-0.5">
            <Switch
              checked={node.isInputNode}
              onCheckedChange={(checked) => updateNode(node.id, { isInputNode: checked })}
            />
          </div>
        </div>
      </div>

      {/* VALIDATE_INPUTS */}
      <div className="py-4 border-b border-slate-800">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-slate-200">VALIDATE_INPUTS</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Adds a <code className="font-mono bg-slate-800 px-1 rounded">validate_inputs()</code> static method
              that ComfyUI calls <strong>before</strong> <code className="font-mono bg-slate-800 px-1 rounded">execute()</code>.
              Use it to check inputs and return a clear error message if something is wrong (e.g. "Width must be divisible by 8").
            </p>
            <p className="text-xs text-slate-500">
              <strong>Use when:</strong> You want to catch invalid input combinations early, before expensive processing starts.
            </p>
          </div>
          <div className="shrink-0 pt-0.5">
            <Switch
              checked={node.validateInputs}
              onCheckedChange={(checked) => updateNode(node.id, { validateInputs: checked })}
            />
          </div>
        </div>
      </div>

      {/* IS_CHANGED */}
      <div className="py-4 border-b border-slate-800">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-slate-200">IS_CHANGED</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Controls when ComfyUI re-runs your node. By default, ComfyUI caches results and only re-executes when
              inputs change. Override this for nodes that need different caching behavior.
            </p>
            <div className="mt-2 space-y-1.5 text-xs text-slate-500">
              <p><strong>None (default):</strong> ComfyUI decides automatically — re-runs only when inputs change. Best for most nodes.</p>
              <p><strong>Always re-run:</strong> Force re-execution every time. Use for nodes with randomness, timestamps, or external data that may change between runs.</p>
              <p><strong>Hash inputs:</strong> Generate an MD5 hash of inputs and only re-run when the hash changes. Use for expensive nodes where you want fine-grained cache control.</p>
            </div>
          </div>
          <div className="shrink-0 pt-0.5">
            <Select
              value={node.isChangedMode}
              onValueChange={(value) => updateNode(node.id, { isChangedMode: value as IsChangedMode })}
            >
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (default)</SelectItem>
                <SelectItem value="always">Always re-run</SelectItem>
                <SelectItem value="hash">Hash inputs</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Generated code notes */}
      <div className="mt-6 rounded-lg bg-slate-800/40 border border-slate-700/50 p-4 space-y-2">
        <p className="text-xs font-semibold text-slate-300">Generated code notes:</p>
        {node.isOutputNode && (
          <p className="text-xs text-slate-400">• <code className="font-mono">OUTPUT_NODE = True</code> will be added to the class.</p>
        )}
        {node.isInputNode && (
          <p className="text-xs text-slate-400">• <code className="font-mono">INPUT_NODE = True</code> will be added to the class.</p>
        )}
        {node.validateInputs && (
          <p className="text-xs text-slate-400">• A <code className="font-mono">VALIDATE_INPUTS</code> stub will be generated — fill in the validation logic.</p>
        )}
        {node.isChangedMode === 'always' && (
          <p className="text-xs text-slate-400">• <code className="font-mono">IS_CHANGED</code> will use <code className="font-mono">time.time()</code> to force re-execution every run.</p>
        )}
        {node.isChangedMode === 'hash' && (
          <p className="text-xs text-slate-400">• <code className="font-mono">IS_CHANGED</code> will hash all inputs with MD5 to detect changes.</p>
        )}
        {!node.isOutputNode && !node.isInputNode && !node.validateInputs && node.isChangedMode === 'none' && (
          <p className="text-xs text-slate-500">No advanced options enabled — the class will use ComfyUI defaults.</p>
        )}
      </div>
    </div>
  )
}
