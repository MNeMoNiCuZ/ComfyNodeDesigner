import React, { useState } from 'react'
import type { ComfyNodeDef, NodeOutput } from '../../types/node.types'
import { useProjectStore } from '../../store/projectStore'
import { Button } from '../ui/button'
import { TypeBadge } from '../shared/CodeBadge'
import { Plus, Trash2, Edit2, GripVertical, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '../../lib/utils'
import { OutputEditModal } from '../modals/OutputEditModal'

interface OutputsTabProps {
  node: ComfyNodeDef
}

export function OutputsTab({ node }: OutputsTabProps): JSX.Element {
  const { updateNode } = useProjectStore()
  const [editingOutput, setEditingOutput] = useState<NodeOutput | null>(null)
  const [addingNew, setAddingNew] = useState(false)
  const [dragging, setDragging] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

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

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {node.outputs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <p className="text-sm text-slate-500">No outputs defined.</p>
            <p className="text-xs text-slate-600 max-w-sm">
              Nodes with no outputs are typically OUTPUT_NODE types (like Save Image). Enable that in the Advanced tab.
            </p>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setAddingNew(true)}>
              <Plus className="h-3.5 w-3.5" />
              Add first output
            </Button>
          </div>
        )}

        {node.outputs.map((output, idx) => (
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
              dragging === idx && 'opacity-50'
            )}
          >
            {/* Drag handle */}
            <GripVertical className="drag-handle h-4 w-4 shrink-0 text-slate-600 group-hover:text-slate-500 cursor-grab" />

            {/* Index */}
            <span className="text-xs text-slate-500 font-mono shrink-0 w-4 text-center">{idx}</span>

            {/* Type badge */}
            <TypeBadge type={output.type} />

            {/* Name + tooltip */}
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-slate-200 font-mono">{output.name}</span>
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
