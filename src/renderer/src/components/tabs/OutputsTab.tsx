import React, { useState } from 'react'
import type { ComfyNodeDef, NodeOutput } from '../../types/node.types'
import { useProjectStore } from '../../store/projectStore'
import { useSettingsStore } from '../../store/settingsStore'
import { Button } from '../ui/button'
import { TypeBadge } from '../shared/CodeBadge'
import { Plus, Trash2, SquarePen, GripVertical, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '../../lib/utils'
import { OutputEditModal } from '../modals/OutputEditModal'

interface OutputsTabProps {
  node: ComfyNodeDef
}

export function OutputsTab({ node }: OutputsTabProps): JSX.Element {
  const { updateNode } = useProjectStore()
  const { pendingProposal } = useSettingsStore()
  const [editingOutput, setEditingOutput] = useState<NodeOutput | null>(null)
  const [addingNew, setAddingNew] = useState(false)
  const [dragging, setDragging] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  const [dragOverHalf, setDragOverHalf] = useState<'top' | 'bottom' | null>(null)
  const [viewingProposed, setViewingProposed] = useState<NodeOutput | null>(null)

  const activeProposal = pendingProposal?.nodeId === node.id ? pendingProposal : null

  const proposalAddedOutputs: Array<any> = []
  const proposalUpdatedOutputs = new Map<string, any>()
  const proposalDeletedOutputNames = new Set<string>()

  if (activeProposal) {
    for (const op of activeProposal.operations) {
      if (op._invalid) continue
      if (op.op === 'add_output') proposalAddedOutputs.push(op)
      else if (op.op === 'update_output') proposalUpdatedOutputs.set(op.name, op)
      else if (op.op === 'delete_output') proposalDeletedOutputNames.add(op.name)
    }
  }

  function handleSaveOutput(output: NodeOutput): void {
    const exists = node.outputs.find((o) => o.id === output.id)
    if (exists) {
      updateNode(node.id, { outputs: node.outputs.map((o) => (o.id === output.id ? output : o)) })
    } else {
      updateNode(node.id, { outputs: [...node.outputs, output] })
    }
    setEditingOutput(null)
    setAddingNew(false)
  }

  function handleDelete(id: string): void {
    updateNode(node.id, { outputs: node.outputs.filter((o) => o.id !== id) })
  }

  function handleMove(id: string, direction: 'up' | 'down'): void {
    const idx = node.outputs.findIndex((o) => o.id === id)
    if (idx === -1) return
    const newIdx = direction === 'up' ? idx - 1 : idx + 1
    if (newIdx < 0 || newIdx >= node.outputs.length) return
    const outputs = [...node.outputs]
    ;[outputs[idx], outputs[newIdx]] = [outputs[newIdx], outputs[idx]]
    updateNode(node.id, { outputs })
  }

  function resetDrag(): void {
    setDragging(null)
    setDragOverIdx(null)
    setDragOverHalf(null)
  }

  function handleDrop(toIdx: number): void {
    if (dragging !== null && dragging !== toIdx) {
      const half = dragOverHalf ?? 'bottom'
      const outputs = [...node.outputs]
      const [moved] = outputs.splice(dragging, 1)
      let insertAt = half === 'top' ? toIdx : toIdx + 1
      if (dragging < toIdx) insertAt--
      outputs.splice(insertAt, 0, moved)
      updateNode(node.id, { outputs })
    }
    resetDrag()
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Outputs</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Define what this node returns. Outputs appear as connection sockets on the right side of the node. They must match the execute() return tuple in order.
          </p>
        </div>
        <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={() => setAddingNew(true)}>
          <Plus className="h-3.5 w-3.5" />
          Add Output
        </Button>
      </div>

      {/* Pending proposal banner */}
      {activeProposal && (proposalAddedOutputs.length > 0 || proposalUpdatedOutputs.size > 0 || proposalDeletedOutputNames.size > 0) && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-900/20 border-b border-amber-700/40 text-xs text-amber-300">
          <span className="flex-1">AI proposal preview active — use the Accept/Reject bar above to apply or discard changes.</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {node.outputs.length === 0 && proposalAddedOutputs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <p className="text-sm text-slate-500">
              No outputs — <span className="text-slate-600">nodes that only produce side effects (e.g. save files) should enable <strong className="text-slate-500">OUTPUT_NODE</strong> in the <strong className="text-slate-500">Advanced</strong> tab instead.</span>
            </p>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setAddingNew(true)}>
              <Plus className="h-3.5 w-3.5" />
              Add first output
            </Button>
          </div>
        )}

        {node.outputs.map((output, idx) => {
          const isDeleted = proposalDeletedOutputNames.has(output.name)
          const updateOp = proposalUpdatedOutputs.get(output.name)
          const isUpdated = updateOp != null
          const updates = updateOp ? (updateOp.updates ?? updateOp) : null
          const displayType = isUpdated && updates?.type ? String(updates.type).toUpperCase() : output.type
          const displayOutput: NodeOutput = isUpdated && updates ? {
            ...output,
            ...(updates.type ? { type: String(updates.type).toUpperCase() as any } : {}),
            ...(typeof updates.tooltip === 'string' ? { tooltip: updates.tooltip } : {}),
            ...(typeof updates.name === 'string' ? { name: updates.name } : {})
          } : output
          const showTopLine = dragOverIdx === idx && dragOverHalf === 'top' && dragging !== idx
          const showBottomLine = dragOverIdx === idx && dragOverHalf === 'bottom' && dragging !== idx

          return (
            <div key={output.id} className="relative">
              {showTopLine && (
                <div className="absolute -top-0.5 left-0 right-0 h-0.5 bg-blue-400 rounded-full z-10 pointer-events-none" />
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
                onDoubleClick={() => setEditingOutput(displayOutput)}
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
                      onClick={(e) => { e.stopPropagation(); handleMove(output.id, 'up') }}
                      disabled={idx === 0}
                      title="Move up"
                    >
                      <ChevronUp className="h-3 w-3" />
                    </button>
                    <button
                      className="rounded p-0.5 text-slate-600 hover:text-slate-300 hover:bg-slate-700 disabled:opacity-20 transition-colors"
                      onClick={(e) => { e.stopPropagation(); handleMove(output.id, 'down') }}
                      disabled={idx === node.outputs.length - 1}
                      title="Move down"
                    >
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </div>
                  <button
                    className="rounded p-1.5 text-slate-400 hover:text-blue-300 hover:bg-slate-700 transition-colors"
                    onClick={(e) => { e.stopPropagation(); setEditingOutput(displayOutput) }}
                    title="Edit output (or double-click row)"
                  >
                    <SquarePen className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Drag handle */}
                <GripVertical className="drag-handle h-4 w-4 shrink-0 text-slate-700 group-hover:text-slate-500 cursor-grab" />

                {/* Index */}
                <span className="text-xs text-slate-500 font-mono shrink-0 w-4 text-center">{idx}</span>

                {/* Proposal badges — absolutely positioned so they don't affect row layout */}
                {isUpdated && (
                  <span className="absolute top-0.5 right-1 z-10 pointer-events-none text-[10px] font-bold text-yellow-300 bg-yellow-900/40 border border-yellow-700/50 rounded px-1.5 py-0.5">WILL CHANGE</span>
                )}
                {isDeleted && (
                  <span className="absolute top-0.5 right-1 z-10 pointer-events-none text-[10px] font-bold text-red-300 bg-red-900/40 border border-red-700/50 rounded px-1.5 py-0.5">WILL DELETE</span>
                )}

                {/* Type badge — fixed width so names align */}
                <div className="w-[5.5rem] shrink-0 flex justify-center">
                  <TypeBadge type={displayType as any} />
                </div>

                {/* Name + tooltip */}
                <div className="flex-1 min-w-0">
                  <span className={cn(
                    'text-sm font-medium font-mono',
                    isDeleted ? 'line-through text-slate-500' : 'text-slate-200'
                  )}>
                    {output.name}
                  </span>
                  {isUpdated && displayType !== output.type && (
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      was: <span className="font-mono">{output.type}</span>
                      <span className="mx-1">→</span>
                      <span className="font-mono text-yellow-400">{displayType}</span>
                    </p>
                  )}
                  {output.tooltip && !isUpdated && (
                    <p className="text-xs text-slate-500 truncate mt-0.5">{output.tooltip}</p>
                  )}
                </div>

                {/* RIGHT: trash */}
                <button
                  className="shrink-0 rounded p-1.5 text-slate-600 hover:text-red-400 hover:bg-slate-700 transition-colors"
                  onClick={(e) => { e.stopPropagation(); handleDelete(output.id) }}
                  title="Delete output"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {showBottomLine && (
                <div className="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-blue-400 rounded-full z-10 pointer-events-none" />
              )}
            </div>
          )
        })}

        {/* Ghost rows for proposed additions */}
        {proposalAddedOutputs.map((op, i) => {
          const opType = String(op.type ?? 'IMAGE').toUpperCase()
          return (
            <div key={`proposed-${i}`} className="relative">
              <div
                className="group flex items-center gap-2 rounded-lg border-l-4 border-l-green-500 border border-green-800/30 bg-green-900/10 px-2 py-2 select-none cursor-pointer"
                onDoubleClick={() => {
                  setViewingProposed({ id: 'proposed-preview', name: op.name, type: opType as any, tooltip: op.tooltip ?? '' })
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
                    title="View proposed output (read-only)"
                    onClick={() => setViewingProposed({ id: 'proposed-preview', name: op.name, type: opType as any, tooltip: op.tooltip ?? '' })}
                  >
                    <SquarePen className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="w-4 shrink-0" />

                {/* Index placeholder */}
                <span className="text-xs text-slate-500 font-mono shrink-0 w-4 text-center opacity-30">—</span>

                {/* NEW badge */}
                <span className="shrink-0 text-[10px] font-bold text-green-300 bg-green-900/40 border border-green-700/50 rounded px-1.5 py-0.5">NEW</span>

                {/* Type badge — fixed width so names align */}
                <div className="w-[5.5rem] shrink-0 flex justify-center">
                  <span className="text-xs font-mono text-slate-300 bg-slate-700/50 rounded px-1.5 py-0.5 uppercase">{opType}</span>
                </div>

                {/* Name + info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-green-300 font-mono">{op.name}</span>
                    <span className="text-[10px] text-green-700 italic">(proposed)</span>
                  </div>
                  {op.tooltip && (
                    <p className="text-xs text-slate-500 truncate mt-0.5">{op.tooltip}</p>
                  )}
                </div>

                {/* RIGHT: disabled trash */}
                <button className="shrink-0 rounded p-1.5 text-slate-700 cursor-not-allowed opacity-30" disabled title="Cannot delete a proposed output">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modals */}
      {(editingOutput || addingNew) && (
        <OutputEditModal
          open={true}
          output={editingOutput ?? undefined}
          onSave={handleSaveOutput}
          onClose={() => { setEditingOutput(null); setAddingNew(false) }}
        />
      )}
      {viewingProposed && (
        <OutputEditModal
          open={true}
          output={viewingProposed}
          onSave={() => {}}
          onClose={() => setViewingProposed(null)}
          readOnly
        />
      )}
    </div>
  )
}
