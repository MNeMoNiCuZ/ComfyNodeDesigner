import React from 'react'
import type { ComfyNodeDef, IsChangedMode } from '../../types/node.types'
import { useProjectStore } from '../../store/projectStore'
import { Switch } from '../ui/switch'
import { FieldLabel } from '../shared/TooltipWrapper'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'

interface AdvancedTabProps {
  node: ComfyNodeDef
}

interface SettingRowProps {
  label: string
  tooltip: string
  children: React.ReactNode
}

function SettingRow({ label, tooltip, children }: SettingRowProps): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-4 py-4 border-b border-slate-800">
      <FieldLabel label={label} tooltip={tooltip} className="pt-0.5" />
      <div className="shrink-0">{children}</div>
    </div>
  )
}

export function AdvancedTab({ node }: AdvancedTabProps): JSX.Element {
  const { updateNode } = useProjectStore()

  return (
    <div className="p-6 max-w-2xl space-y-0">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-slate-200">Advanced Settings</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Configure special ComfyUI node behaviours. These affect how ComfyUI treats this node in the execution pipeline.
        </p>
      </div>

      <SettingRow
        label="OUTPUT_NODE"
        tooltip="Mark this node as an output node (e.g. Save Image, Preview Image). Output nodes are always executed when present in a workflow, even if their outputs are not used downstream. Required for nodes that save files or display previews."
      >
        <Switch
          checked={node.isOutputNode}
          onCheckedChange={(checked) => updateNode(node.id, { isOutputNode: checked })}
        />
      </SettingRow>

      <SettingRow
        label="INPUT_NODE"
        tooltip="Mark this node as an input node — one that receives external data such as images from the web UI or file uploads. Rarely needed for custom nodes."
      >
        <Switch
          checked={node.isInputNode}
          onCheckedChange={(checked) => updateNode(node.id, { isInputNode: checked })}
        />
      </SettingRow>

      <SettingRow
        label="VALIDATE_INPUTS"
        tooltip="Add a validate_inputs() static method. ComfyUI calls this before execute() to let you validate the inputs and return an error message if they are invalid. Return True if valid, or a string error message."
      >
        <Switch
          checked={node.validateInputs}
          onCheckedChange={(checked) => updateNode(node.id, { validateInputs: checked })}
        />
      </SettingRow>

      <SettingRow
        label="IS_CHANGED"
        tooltip="Controls when ComfyUI re-executes this node. 'None' = ComfyUI decides based on input changes (default). 'Always' = re-execute every run (good for random/time-dependent nodes). 'Hash' = generate a hash of inputs and re-execute only when it changes (for expensive nodes where you want fine-grained control)."
      >
        <Select
          value={node.isChangedMode}
          onValueChange={(value) => updateNode(node.id, { isChangedMode: value as IsChangedMode })}
        >
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None (default)</SelectItem>
            <SelectItem value="always">Always re-run</SelectItem>
            <SelectItem value="hash">Hash inputs</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>

      {/* Explanatory notes */}
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
