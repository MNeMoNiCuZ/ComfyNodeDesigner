import React, { useState } from 'react'
import type { ComfyNodeDef, NodeInput } from '../../types/node.types'
import { useProjectStore } from '../../store/projectStore'
import { useSettingsStore } from '../../store/settingsStore'
import { Button } from '../ui/button'
import { TypeBadge } from '../shared/CodeBadge'
import { Plus, Trash2, Edit2, GripVertical, ChevronDown, ChevronUp, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { InputEditModal } from '../modals/InputEditModal'
import { Switch } from '../ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'

interface InputsTabProps {
  node: ComfyNodeDef
}

export function InputsTab({ node }: InputsTabProps): JSX.Element {
  const { updateNode } = useProjectStore()
  const { pendingProposal, setPendingProposal } = useSettingsStore()
  const [editingInput, setEditingInput] = useState<NodeInput | null>(null)
  const [addingNew, setAddingNew] = useState(false)
  const [dragging, setDragging] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  const activeProposal = pendingProposal?.nodeId === node.id ? pendingProposal : null

  // Build lookup maps from proposal operations
  const proposalAddedInputs: Array<{ name: string; type: string; required?: boolean }> = []
  const proposalUpdatedInputNames = new Set<string>()
  const proposalDeletedInputNames = new Set<string>()

  if (activeProposal) {
    for (const op of activeProposal.operations) {
      if (op.op === 'add_input') {
        proposalAddedInputs.push({ name: op.name, type: op.type ?? 'IMAGE', required: op.required !== false })
      } else if (op.op === 'update_input') {
        proposalUpdatedInputNames.add(op.name)
      } else if (op.op === 'delete_input') {
        proposalDeletedInputNames.add(op.name)
      }
    }
  }

  function handleSaveInput(input: NodeInput): void {
    const exists = node.inputs.find((i) => i.id === input.id)
    if (exists) {
      updateNode(node.id, {
        inputs: node.inputs.map((i) => (i.id === input.id ? input : i))
      })
    } else {
      updateNode(node.id, { inputs: [...node.inputs, input] })
    }
    setEditingInput(null)
    setAddingNew(false)
  }

  function handleDelete(id: string): void {
    updateNode(node.id, { inputs: node.inputs.filter((i) => i.id !== id) })
  }

  function handleToggleRequired(id: string, required: boolean): void {
    updateNode(node.id, {
      inputs: node.inputs.map((i) => (i.id === id ? { ...i, required } : i))
    })
  }

  function handleMove(id: string, direction: 'up' | 'down'): void {
    const idx = node.inputs.findIndex((i) => i.id === id)
    if (idx === -1) return
    const newIdx = direction === 'up' ? idx - 1 : idx + 1
    if (newIdx < 0 || newIdx >= node.inputs.length) return
    const inputs = [...node.inputs]
    ;[inputs[idx], inputs[newIdx]] = [inputs[newIdx], inputs[idx]]
    updateNode(node.id, { inputs })
  }

  function handleDrop(toIdx: number): void {
    if (dragging !== null && dragging !== toIdx) {
      const inputs = [...node.inputs]
      const [moved] = inputs.splice(dragging, 1)
      inputs.splice(toIdx, 0, moved)
      updateNode(node.id, { inputs })
    }
    setDragging(null)
    setDragOver(null)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Inputs</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Define what data this node receives. Widget types (INT, FLOAT, STRING, BOOLEAN, COMBO) render as inline controls; all others appear as connection sockets.
          </p>
        </div>
        <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={() => setAddingNew(true)}>
          <Plus className="h-3.5 w-3.5" />
          Add Input
        </Button>
      </div>

      {/* Pending proposal banner */}
      {activeProposal && (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-900/20 border-b border-blue-700/40 text-xs text-blue-300">
          <span className="flex-1">AI proposal preview active — click &apos;Apply&apos; in the AI Assistant tab to apply changes, or &apos;Clear Preview&apos; to dismiss.</span>
          <button
            onClick={() => setPendingProposal(null)}
            className="shrink-0 rounded p-0.5 hover:bg-blue-800/40"
            title="Dismiss preview"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Input list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {node.inputs.length === 0 && proposalAddedInputs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <p className="text-sm text-slate-500">No inputs defined.</p>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setAddingNew(true)}>
              <Plus className="h-3.5 w-3.5" />
              Add first input
            </Button>
          </div>
        )}

        {node.inputs.map((input, idx) => {
          const isUpdated = proposalUpdatedInputNames.has(input.name)
          const isDeleted = proposalDeletedInputNames.has(input.name)
          return (
            <div
              key={input.id}
              draggable
              onDragStart={() => setDragging(idx)}
              onDragOver={(e) => { e.preventDefault(); setDragOver(idx) }}
              onDrop={() => handleDrop(idx)}
              onDragEnd={() => { setDragging(null); setDragOver(null) }}
              className={cn(
                'group flex items-center gap-3 rounded-lg border border-slate-700/60 bg-slate-800/40 px-3 py-2.5 transition-colors',
                dragOver === idx && dragging !== idx && 'border-blue-500',
                dragging === idx && 'opacity-50',
                isUpdated && 'border-l-2 border-l-yellow-500/70',
                isDeleted && 'border-l-2 border-l-red-500/70 opacity-60'
              )}
            >
              {/* Drag handle */}
              <GripVertical className="drag-handle h-4 w-4 shrink-0 text-slate-600 group-hover:text-slate-500 cursor-grab" />

              {/* Proposal indicator */}
              {isUpdated && (
                <span className="shrink-0 text-[10px] font-bold text-yellow-400 bg-yellow-900/30 rounded px-1">~</span>
              )}
              {isDeleted && (
                <span className="shrink-0 text-[10px] font-bold text-red-400 bg-red-900/30 rounded px-1">-</span>
              )}

              {/* Type badge */}
              <TypeBadge type={input.type} />

              {/* Name + tooltip */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn("text-sm font-medium text-slate-200 font-mono", isDeleted && 'line-through')}>{input.name}</span>
                  {input.forceInput && (
                    <span className="text-xs text-slate-500 bg-slate-700 rounded px-1">force_input</span>
                  )}
                </div>
                {input.tooltip && (
                  <p className="text-xs text-slate-500 truncate mt-0.5">{input.tooltip}</p>
                )}
                {input.widget && input.type !== 'COMBO' && (
                  <p className="text-xs text-slate-600 font-mono mt-0.5">
                    {[
                      input.widget.default !== undefined && `default=${input.widget.default}`,
                      input.widget.min !== undefined && `min=${input.widget.min}`,
                      input.widget.max !== undefined && `max=${input.widget.max}`,
                      input.widget.step !== undefined && `step=${input.widget.step}`,
                      input.widget.multiline && 'multiline',
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                )}
                {input.widget?.comboOptions && (
                  <p className="text-xs text-slate-600 font-mono mt-0.5">
                    [{input.widget.comboOptions.slice(0, 3).map(o => `"${o}"`).join(', ')}{input.widget.comboOptions.length > 3 ? `… +${input.widget.comboOptions.length - 3}` : ''}]
                  </p>
                )}
              </div>

              {/* Required toggle */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">{input.required ? 'req' : 'opt'}</span>
                    <Switch
                      checked={input.required}
                      onCheckedChange={(checked) => handleToggleRequired(input.id, checked)}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {input.required
                    ? 'Required — must be connected'
                    : 'Optional — has a default or can be left disconnected'}
                </TooltipContent>
              </Tooltip>

              {/* Order controls */}
              <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  className="rounded p-0.5 text-slate-600 hover:text-slate-300 hover:bg-slate-700 disabled:opacity-30"
                  onClick={() => handleMove(input.id, 'up')}
                  disabled={idx === 0}
                >
                  <ChevronUp className="h-3 w-3" />
                </button>
                <button
                  className="rounded p-0.5 text-slate-600 hover:text-slate-300 hover:bg-slate-700 disabled:opacity-30"
                  onClick={() => handleMove(input.id, 'down')}
                  disabled={idx === node.inputs.length - 1}
                >
                  <ChevronDown className="h-3 w-3" />
                </button>
              </div>

              {/* Edit / Delete */}
              <div className="flex items-center gap-1">
                <button
                  className="rounded p-1 text-slate-500 hover:text-slate-200 hover:bg-slate-700"
                  onClick={() => setEditingInput(input)}
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button
                  className="rounded p-1 text-slate-500 hover:text-red-400 hover:bg-slate-700"
                  onClick={() => handleDelete(input.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )
        })}

        {/* Ghost rows for proposed additions */}
        {proposalAddedInputs.map((proposed, i) => (
          <div
            key={`proposed-${i}`}
            className="flex items-center gap-3 rounded-lg border-l-2 border-l-green-500/70 border border-green-800/30 bg-green-900/10 px-3 py-2.5"
          >
            <span className="shrink-0 text-[10px] font-bold text-green-400 bg-green-900/30 rounded px-1">+</span>
            <span className="text-xs font-mono text-slate-500 bg-slate-700/50 rounded px-1.5 py-0.5 uppercase">{proposed.type}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-green-300/80 font-mono">{proposed.name}</span>
                <span className="text-[10px] text-green-600 italic">(proposed)</span>
              </div>
            </div>
            <span className="text-xs text-slate-500">{proposed.required !== false ? 'req' : 'opt'}</span>
          </div>
        ))}
      </div>

      {/* Modals */}
      {(editingInput || addingNew) && (
        <InputEditModal
          open={true}
          input={editingInput ?? undefined}
          onSave={handleSaveInput}
          onClose={() => { setEditingInput(null); setAddingNew(false) }}
        />
      )}
    </div>
  )
}
