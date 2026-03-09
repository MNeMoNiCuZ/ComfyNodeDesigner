import React, { useState } from 'react'
import type { ComfyNodeDef, NodeOutput } from '../../types/node.types'
import { createDefaultOutput } from '../../types/node.types'
import { useProjectStore } from '../../store/projectStore'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { TypeBadge } from '../shared/CodeBadge'
import { TypeSelector } from '../shared/TypeSelector'
import { Plus, Trash2, GripVertical, Check, X as XIcon } from 'lucide-react'
import { cn } from '../../lib/utils'

interface OutputsTabProps {
  node: ComfyNodeDef
}

interface EditingOutput {
  id: string
  name: string
  type: import('../../types/node.types').ComfyType
  tooltip: string
}

export function OutputsTab({ node }: OutputsTabProps): JSX.Element {
  const { updateNode } = useProjectStore()
  const [editing, setEditing] = useState<EditingOutput | null>(null)
  const [dragging, setDragging] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  function startEdit(output: NodeOutput): void {
    setEditing({ id: output.id, name: output.name, type: output.type, tooltip: output.tooltip ?? '' })
  }

  function cancelEdit(): void {
    setEditing(null)
  }

  function saveEdit(): void {
    if (!editing) return
    const isNew = !node.outputs.find((o) => o.id === editing.id)
    if (isNew) {
      updateNode(node.id, {
        outputs: [...node.outputs, { id: editing.id, name: editing.name, type: editing.type, tooltip: editing.tooltip }]
      })
    } else {
      updateNode(node.id, {
        outputs: node.outputs.map((o) =>
          o.id === editing.id
            ? { ...o, name: editing.name, type: editing.type, tooltip: editing.tooltip }
            : o
        )
      })
    }
    setEditing(null)
  }

  function handleAddNew(): void {
    const output = createDefaultOutput()
    setEditing({ id: output.id, name: output.name, type: output.type, tooltip: '' })
  }

  function handleDelete(id: string): void {
    updateNode(node.id, { outputs: node.outputs.filter((o) => o.id !== id) })
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
            Define what this node outputs. Outputs appear as connection sockets on the right side of the node. They must match the execute() return tuple in order.
          </p>
        </div>
        <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={handleAddNew}>
          <Plus className="h-3.5 w-3.5" />
          Add Output
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {node.outputs.length === 0 && !editing && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <p className="text-sm text-slate-500">No outputs defined.</p>
            <p className="text-xs text-slate-600 max-w-sm">
              Nodes with no outputs are typically OUTPUT_NODE types (like Save Image). Enable that in the Advanced tab.
            </p>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleAddNew}>
              <Plus className="h-3.5 w-3.5" />
              Add first output
            </Button>
          </div>
        )}

        {node.outputs.map((output, idx) => {
          const isEditing = editing?.id === output.id

          if (isEditing && editing) {
            return (
              <div key={output.id} className="rounded-lg border border-blue-500/50 bg-slate-800/60 p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Name</label>
                    <Input
                      value={editing.name}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                      className="h-8 text-sm font-mono"
                      autoFocus
                      placeholder="output_name"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Type</label>
                    <TypeSelector
                      value={editing.type}
                      onChange={(t) => setEditing({ ...editing, type: t })}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Tooltip (optional)</label>
                  <Input
                    value={editing.tooltip}
                    onChange={(e) => setEditing({ ...editing, tooltip: e.target.value })}
                    className="h-8 text-sm"
                    placeholder="Describe this output…"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={cancelEdit}>
                    <XIcon className="h-3.5 w-3.5 mr-1" /> Cancel
                  </Button>
                  <Button size="sm" className="h-7 text-xs" onClick={saveEdit} disabled={!editing.name}>
                    <Check className="h-3.5 w-3.5 mr-1" /> Save
                  </Button>
                </div>
              </div>
            )
          }

          return (
            <div
              key={output.id}
              draggable
              onDragStart={() => setDragging(idx)}
              onDragOver={(e) => { e.preventDefault(); setDragOver(idx) }}
              onDrop={() => handleDrop(idx)}
              onDragEnd={() => { setDragging(null); setDragOver(null) }}
              className={cn(
                'group flex items-center gap-3 rounded-lg border border-slate-700/60 bg-slate-800/40 px-3 py-2.5 cursor-pointer hover:bg-slate-800/70 transition-colors',
                dragOver === idx && dragging !== idx && 'border-blue-500',
                dragging === idx && 'opacity-50'
              )}
              onClick={() => startEdit(output)}
            >
              <GripVertical className="drag-handle h-4 w-4 shrink-0 text-slate-600 group-hover:text-slate-500 cursor-grab" />
              <span className="text-xs text-slate-500 font-mono shrink-0 w-4 text-center">{idx}</span>
              <TypeBadge type={output.type} />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-slate-200 font-mono">{output.name}</span>
                {output.tooltip && (
                  <p className="text-xs text-slate-500 truncate mt-0.5">{output.tooltip}</p>
                )}
              </div>
              <button
                className="opacity-0 group-hover:opacity-100 rounded p-1 text-slate-500 hover:text-red-400 hover:bg-slate-700 transition-opacity"
                onClick={(e) => { e.stopPropagation(); handleDelete(output.id) }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )
        })}

        {/* New output inline editor (when adding) */}
        {editing && !node.outputs.find((o) => o.id === editing.id) && (
          <div className="rounded-lg border border-blue-500/50 bg-slate-800/60 p-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Name</label>
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="h-8 text-sm font-mono"
                  autoFocus
                  placeholder="output_name"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Type</label>
                <TypeSelector
                  value={editing.type}
                  onChange={(t) => setEditing({ ...editing, type: t })}
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Tooltip (optional)</label>
              <Input
                value={editing.tooltip}
                onChange={(e) => setEditing({ ...editing, tooltip: e.target.value })}
                className="h-8 text-sm"
                placeholder="Describe this output…"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={cancelEdit}>
                <XIcon className="h-3.5 w-3.5 mr-1" /> Cancel
              </Button>
              <Button size="sm" className="h-7 text-xs" onClick={saveEdit} disabled={!editing.name}>
                <Check className="h-3.5 w-3.5 mr-1" /> Add
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
