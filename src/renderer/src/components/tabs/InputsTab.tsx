import React, { useState } from 'react'
import type { ComfyNodeDef, NodeInput } from '../../types/node.types'
import { useProjectStore } from '../../store/projectStore'
import { useSettingsStore } from '../../store/settingsStore'
import { Button } from '../ui/button'
import { TypeBadge } from '../shared/CodeBadge'
import { Plus, Trash2, SquarePen, GripVertical, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '../../lib/utils'
import { InputEditModal } from '../modals/InputEditModal'
import { Switch } from '../ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'

const WIDGET_TYPES = new Set(['INT', 'FLOAT', 'STRING', 'BOOLEAN', 'COMBO'])

interface InputsTabProps {
  node: ComfyNodeDef
}

export function InputsTab({ node }: InputsTabProps): JSX.Element {
  const { updateNode } = useProjectStore()
  const { pendingProposal } = useSettingsStore()
  const [editingInput, setEditingInput] = useState<NodeInput | null>(null)
  const [addingNew, setAddingNew] = useState(false)
  const [dragging, setDragging] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  const [dragOverHalf, setDragOverHalf] = useState<'top' | 'bottom' | null>(null)
  const [viewingProposed, setViewingProposed] = useState<NodeInput | null>(null)

  const activeProposal = pendingProposal?.nodeId === node.id ? pendingProposal : null

  // Build lookup maps from proposal operations
  const proposalAddedInputs: Array<any> = []
  const proposalUpdatedInputs = new Map<string, any>()
  const proposalDeletedInputNames = new Set<string>()

  if (activeProposal) {
    for (const op of activeProposal.operations) {
      if (op._invalid) continue
      if (op.op === 'add_input') proposalAddedInputs.push(op)
      else if (op.op === 'update_input') proposalUpdatedInputs.set(op.name, op)
      else if (op.op === 'delete_input') proposalDeletedInputNames.add(op.name)
    }
  }

  function handleSaveInput(input: NodeInput): void {
    const exists = node.inputs.find((i) => i.id === input.id)
    if (exists) {
      updateNode(node.id, { inputs: node.inputs.map((i) => (i.id === input.id ? input : i)) })
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

  function resetDrag(): void {
    setDragging(null)
    setDragOverIdx(null)
    setDragOverHalf(null)
  }

  function handleDrop(toIdx: number): void {
    if (dragging !== null && dragging !== toIdx) {
      const half = dragOverHalf ?? 'bottom'
      const inputs = [...node.inputs]
      const [moved] = inputs.splice(dragging, 1)
      let insertAt = half === 'top' ? toIdx : toIdx + 1
      if (dragging < toIdx) insertAt--
      inputs.splice(insertAt, 0, moved)
      updateNode(node.id, { inputs })
    }
    resetDrag()
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
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-900/20 border-b border-amber-700/40 text-xs text-amber-300">
          <span className="flex-1">AI proposal preview active — use the Accept/Reject bar above to apply or discard changes.</span>
        </div>
      )}

      {/* Input list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
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
          const isDeleted = proposalDeletedInputNames.has(input.name)
          const updateOp = proposalUpdatedInputs.get(input.name)
          const isUpdated = updateOp != null
          const displayInput = isUpdated
            ? {
                ...input,
                ...(updateOp.updates ?? updateOp),
                type: ((updateOp.updates ?? updateOp).type
                  ? String((updateOp.updates ?? updateOp).type).toUpperCase()
                  : input.type) as any
              }
            : input
          const showTopLine = dragOverIdx === idx && dragOverHalf === 'top' && dragging !== idx
          const showBottomLine = dragOverIdx === idx && dragOverHalf === 'bottom' && dragging !== idx

          return (
            <div
              key={input.id}
              className="relative"
            >
              {/* Drop indicator: before */}
              {showTopLine && (
                <div className="absolute -top-0.5 left-0 right-0 h-0.5 bg-blue-400 rounded-full z-10 pointer-events-none" />
              )}
              {/* Proposal badges — absolutely positioned so they don't affect row layout */}
              {isUpdated && (
                <span className="absolute top-0.5 right-1 z-10 text-[10px] font-bold text-yellow-300 bg-yellow-900/60 border border-yellow-700/50 rounded px-1.5 py-0.5 pointer-events-none">WILL CHANGE</span>
              )}
              {isDeleted && (
                <span className="absolute top-0.5 right-1 z-10 text-[10px] font-bold text-red-300 bg-red-900/60 border border-red-700/50 rounded px-1.5 py-0.5 pointer-events-none">WILL DELETE</span>
              )}
              <div
                draggable
                onDragStart={() => setDragging(idx)}
                onDragOver={(e) => {
                  e.preventDefault()
                  const rect = e.currentTarget.getBoundingClientRect()
                  setDragOverIdx(idx)
                  setDragOverHalf((e.clientY - rect.top) < rect.height / 2 ? 'top' : 'bottom')
                }}
                onDrop={() => handleDrop(idx)}
                onDragEnd={resetDrag}
                onDragLeave={() => { if (dragOverIdx === idx) { setDragOverIdx(null); setDragOverHalf(null) } }}
                onDoubleClick={() => setEditingInput(displayInput)}
                className={cn(
                  'group flex items-center gap-2 rounded-lg border bg-slate-800/40 px-2 py-2 transition-colors select-none cursor-pointer',
                  dragging === idx && 'opacity-40',
                  !isUpdated && !isDeleted && (dragOverIdx === idx ? 'border-transparent' : 'border-slate-700/60'),
                  isUpdated && 'border-l-4 border-l-yellow-500 border-slate-700/60',
                  isDeleted && 'border-l-4 border-l-red-500 border-slate-700/60 opacity-60'
                )}
              >
                {/* LEFT: up/down + edit */}
                <div className="flex items-center gap-0.5 shrink-0">
                  <div className="flex flex-col gap-0">
                    <button
                      className="rounded p-0.5 text-slate-600 hover:text-slate-300 hover:bg-slate-700 disabled:opacity-20 transition-colors"
                      onClick={(e) => { e.stopPropagation(); handleMove(input.id, 'up') }}
                      disabled={idx === 0}
                      title="Move up"
                    >
                      <ChevronUp className="h-3 w-3" />
                    </button>
                    <button
                      className="rounded p-0.5 text-slate-600 hover:text-slate-300 hover:bg-slate-700 disabled:opacity-20 transition-colors"
                      onClick={(e) => { e.stopPropagation(); handleMove(input.id, 'down') }}
                      disabled={idx === node.inputs.length - 1}
                      title="Move down"
                    >
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </div>
                  <button
                    className="rounded p-1.5 text-slate-400 hover:text-blue-300 hover:bg-slate-700 transition-colors"
                    onClick={(e) => { e.stopPropagation(); setEditingInput(displayInput) }}
                    title="Edit input (or double-click row)"
                  >
                    <SquarePen className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Drag handle */}
                <GripVertical className="drag-handle h-4 w-4 shrink-0 text-slate-700 group-hover:text-slate-500 cursor-grab" />

                {/* Index */}
                <span className="text-xs text-slate-500 font-mono shrink-0 w-4 text-center">{idx}</span>

                {/* Req/opt toggle */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <span className="text-[10px] text-muted-foreground w-5">{input.required ? 'req' : 'opt'}</span>
                      <Switch
                        checked={input.required}
                        onCheckedChange={(checked) => handleToggleRequired(input.id, checked)}
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    {input.required ? 'Required — must be connected' : 'Optional — has a default or can be left disconnected'}
                  </TooltipContent>
                </Tooltip>

                {/* Type badge — fixed width so names align */}
                <div className="w-[5.5rem] shrink-0 flex justify-center">
                  <TypeBadge type={displayInput.type} />
                </div>

                {/* Name + info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-sm font-medium font-mono',
                      isDeleted ? 'line-through text-slate-500' : 'text-slate-200'
                    )}>
                      {input.name}
                    </span>
                    {input.forceInput && (
                      <span className="text-xs text-slate-500 bg-slate-700 rounded px-1">force_input</span>
                    )}
                  </div>
                  {isUpdated && displayInput.type !== input.type && (
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      was: <span className="font-mono">{input.type}</span>
                      <span className="mx-1">→</span>
                      <span className="font-mono text-yellow-400">{displayInput.type}</span>
                    </p>
                  )}
                  {input.tooltip && !isUpdated && (
                    <p className="text-xs text-slate-500 truncate mt-0.5">{input.tooltip}</p>
                  )}
                  {input.widget && input.type !== 'COMBO' && !isUpdated && (
                    <p className="text-xs text-slate-600 font-mono mt-0.5">
                      {[
                        input.widget.default !== undefined && `default=${input.widget.default}`,
                        input.widget.min !== undefined && `min=${input.widget.min}`,
                        input.widget.max !== undefined && `max=${input.widget.max}`,
                        input.widget.step !== undefined && `step=${input.widget.step}`,
                        input.widget.multiline && 'multiline',
                      ].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {input.widget?.comboOptions && !isUpdated && (
                    <p className="text-xs text-slate-600 font-mono mt-0.5">
                      [{input.widget.comboOptions.slice(0, 3).map(o => `"${o}"`).join(', ')}{input.widget.comboOptions.length > 3 ? `… +${input.widget.comboOptions.length - 3}` : ''}]
                    </p>
                  )}
                </div>

                {/* RIGHT: trash */}
                <button
                  className="shrink-0 rounded p-1.5 text-slate-600 hover:text-red-400 hover:bg-slate-700 transition-colors"
                  onClick={(e) => { e.stopPropagation(); handleDelete(input.id) }}
                  title="Delete input"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {/* Drop indicator: after */}
              {showBottomLine && (
                <div className="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-blue-400 rounded-full z-10 pointer-events-none" />
              )}
            </div>
          )
        })}

        {/* Ghost rows for proposed additions */}
        {proposalAddedInputs.map((op, i) => {
          const opType = String(op.type ?? 'IMAGE').toUpperCase()
          const isForceInput = op.forceInput ?? !WIDGET_TYPES.has(opType)
          const opRequired = op.required !== false
          return (
            <div key={`proposed-${i}`} className="relative">
              <div
                className="group flex items-center gap-2 rounded-lg border-l-4 border-l-green-500 border border-green-800/30 bg-green-900/10 px-2 py-2 select-none cursor-pointer"
                onDoubleClick={() => {
                  const proposedInput: NodeInput = {
                    id: 'proposed-preview',
                    name: op.name,
                    type: opType as any,
                    required: opRequired,
                    forceInput: isForceInput,
                    tooltip: op.tooltip ?? '',
                    widget: op.widget
                  }
                  setViewingProposed(proposedInput)
                }}
              >
                {/* LEFT: disabled arrows + edit */}
                <div className="flex items-center gap-0.5 shrink-0">
                  <div className="flex flex-col gap-0 opacity-20">
                    <button className="rounded p-0.5 text-slate-600 cursor-not-allowed" disabled>
                      <ChevronUp className="h-3 w-3" />
                    </button>
                    <button className="rounded p-0.5 text-slate-600 cursor-not-allowed" disabled>
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </div>
                  <button
                    className="rounded p-1.5 text-green-500 hover:text-green-300 hover:bg-slate-700 transition-colors"
                    title="View proposed input (read-only)"
                    onClick={() => {
                      const proposedInput: NodeInput = {
                        id: 'proposed-preview',
                        name: op.name,
                        type: opType as any,
                        required: opRequired,
                        forceInput: isForceInput,
                        tooltip: op.tooltip ?? '',
                        widget: op.widget
                      }
                      setViewingProposed(proposedInput)
                    }}
                  >
                    <SquarePen className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* No drag handle for ghost rows */}
                <div className="w-4 shrink-0" />

                {/* Index placeholder */}
                <span className="text-xs text-slate-500 font-mono shrink-0 w-4 text-center opacity-30">—</span>

                {/* NEW badge */}
                <span className="shrink-0 text-[10px] font-bold text-green-300 bg-green-900/40 border border-green-700/50 rounded px-1.5 py-0.5">NEW</span>

                {/* Req display (non-interactive) */}
                <div className="flex items-center gap-1 shrink-0 opacity-60">
                  <span className="text-[10px] text-muted-foreground w-5">{opRequired ? 'req' : 'opt'}</span>
                  <Switch checked={opRequired} onCheckedChange={() => {}} disabled />
                </div>

                {/* Type badge — fixed width so names align */}
                <div className="w-[5.5rem] shrink-0 flex justify-center">
                  <span className="text-xs font-mono text-slate-300 bg-slate-700/50 rounded px-1.5 py-0.5 uppercase">{opType}</span>
                </div>

                {/* Name + info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-green-300 font-mono">{op.name}</span>
                    {isForceInput && (
                      <span className="text-xs text-slate-500 bg-slate-700 rounded px-1">force_input</span>
                    )}
                    <span className="text-[10px] text-green-700 italic">(proposed)</span>
                  </div>
                  {op.tooltip && (
                    <p className="text-xs text-slate-500 truncate mt-0.5">{op.tooltip}</p>
                  )}
                  {op.widget && opType !== 'COMBO' && (
                    <p className="text-xs text-slate-600 font-mono mt-0.5">
                      {[
                        op.widget.default !== undefined && `default=${op.widget.default}`,
                        op.widget.min !== undefined && `min=${op.widget.min}`,
                        op.widget.max !== undefined && `max=${op.widget.max}`,
                        op.widget.step !== undefined && `step=${op.widget.step}`,
                        op.widget.multiline && 'multiline',
                      ].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {op.widget?.comboOptions && (
                    <p className="text-xs text-slate-600 font-mono mt-0.5">
                      [{op.widget.comboOptions.slice(0, 3).map((o: string) => `"${o}"`).join(', ')}{op.widget.comboOptions.length > 3 ? `… +${op.widget.comboOptions.length - 3}` : ''}]
                    </p>
                  )}
                </div>

                {/* RIGHT: disabled trash */}
                <button className="shrink-0 rounded p-1.5 text-slate-700 cursor-not-allowed opacity-30" disabled title="Cannot delete a proposed input">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )
        })}
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
      {viewingProposed && (
        <InputEditModal
          open={true}
          input={viewingProposed}
          onSave={() => {}}
          onClose={() => setViewingProposed(null)}
          readOnly
        />
      )}
    </div>
  )
}
