import React, { useState } from 'react'
import type { ComfyNodeDef, NodeOutput } from '../../types/node.types'
import { useProjectStore } from '../../store/projectStore'
import { useSettingsStore } from '../../store/settingsStore'
import { Button } from '../ui/button'
import { TypeBadge } from '../shared/CodeBadge'
import { Plus, Trash2, Edit2, GripVertical, ChevronDown, ChevronUp, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { OutputEditModal } from '../modals/OutputEditModal'

interface OutputsTabProps {
  node: ComfyNodeDef
}

export function OutputsTab({ node }: OutputsTabProps): JSX.Element {
  const { updateNode } = useProjectStore()
  const { pendingProposal, setPendingProposal } = useSettingsStore()
  const [editingOutput, setEditingOutput] = useState<NodeOutput | null>(null)
  const [addingNew, setAddingNew] = useState(false)
  const [dragging, setDragging] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  const activeProposal = pendingProposal?.nodeId === node.id ? pendingProposal : null

  // Build lookup maps from proposal operations
  const proposalAddedOutputs: Array<{ name: string; type: string }> = []
  const proposalUpdatedOutputNames = new Set<string>()
  const proposalDeletedOutputNames = new Set<string>()

  if (activeProposal) {
    for (const op of activeProposal.operations) {
      if (op.op === 'add_output') {
        proposalAddedOutputs.push({ name: op.name, type: op.type ?? 'IMAGE' })
      } else if (op.op === 'update_output') {
        proposalUpdatedOutputNames.add(op.name)
      } else if (op.op === 'delete_output') {
        proposalDeletedOutputNames.add(op.name)
      }
    }
  }

  function handleSaveOutput(output: NodeOutput): void {
    const exists = node.outputs.find((o) => o.id === output.id)
    if (exists) {
      updateNode(node.id, {
        outputs: node.outputs.map((o) => (o.id === output.id ? output : o))
      })
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

  function handleDrop(toIdx: number): void {
    if (dragging !== null && dragging !== toIdx) {
      const outputs = [...node.outputs]
      const [moved] = outputs.splice(dragging, 1)
      outputs.splice(toIdx, 0, moved)
      updateNode(node.id, { outputs })
    }
    setDragging(null)
    setDragOver(null)
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
      {activeProposal && (proposalAddedOutputs.length > 0 || proposalUpdatedOutputNames.size > 0 || proposalDeletedOutputNames.size > 0) && (
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

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
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
          const isUpdated = proposalUpdatedOutputNames.has(output.name)
          const isDeleted = proposalDeletedOutputNames.has(output.name)
          return (
            <div
              key={output.id}
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

              {/* Index */}
              <span className="text-xs text-slate-500 font-mono shrink-0 w-4 text-center">{idx}</span>

              {/* Type badge */}
              <TypeBadge type={output.type} />

              {/* Name + tooltip */}
              <div className="flex-1 min-w-0">
                <span className={cn("text-sm font-medium text-slate-200 font-mono", isDeleted && 'line-through')}>{output.name}</span>
                {output.tooltip && (
                  <p className="text-xs text-slate-500 truncate mt-0.5">{output.tooltip}</p>
                )}
              </div>

              {/* Order controls */}
              <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  className="rounded p-0.5 text-slate-600 hover:text-slate-300 hover:bg-slate-700 disabled:opacity-30"
                  onClick={() => handleMove(output.id, 'up')}
                  disabled={idx === 0}
                >
                  <ChevronUp className="h-3 w-3" />
                </button>
                <button
                  className="rounded p-0.5 text-slate-600 hover:text-slate-300 hover:bg-slate-700 disabled:opacity-30"
                  onClick={() => handleMove(output.id, 'down')}
                  disabled={idx === node.outputs.length - 1}
                >
                  <ChevronDown className="h-3 w-3" />
                </button>
              </div>

              {/* Edit / Delete */}
              <div className="flex items-center gap-1">
                <button
                  className="rounded p-1 text-slate-500 hover:text-slate-200 hover:bg-slate-700"
                  onClick={() => setEditingOutput(output)}
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button
                  className="rounded p-1 text-slate-500 hover:text-red-400 hover:bg-slate-700"
                  onClick={() => handleDelete(output.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )
        })}

        {/* Ghost rows for proposed additions */}
        {proposalAddedOutputs.map((proposed, i) => (
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
          </div>
        ))}
      </div>

      {/* Modal */}
      {(editingOutput || addingNew) && (
        <OutputEditModal
          open={true}
          output={editingOutput ?? undefined}
          onSave={handleSaveOutput}
          onClose={() => { setEditingOutput(null); setAddingNew(false) }}
        />
      )}
    </div>
  )
}
