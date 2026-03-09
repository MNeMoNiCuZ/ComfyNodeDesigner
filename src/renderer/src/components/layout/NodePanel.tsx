import React, { useState } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { Button } from '../ui/button'
import { Plus, Trash2, Copy, GripVertical, Box } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'

export function NodePanel(): JSX.Element {
  const { project, selectedNodeId, addNode, deleteNode, duplicateNode, selectNode, reorderNodes } =
    useProjectStore()
  const [dragging, setDragging] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  const nodes = project.nodes

  function handleDragStart(idx: number): void {
    setDragging(idx)
  }

  function handleDragOver(e: React.DragEvent, idx: number): void {
    e.preventDefault()
    setDragOver(idx)
  }

  function handleDrop(idx: number): void {
    if (dragging !== null && dragging !== idx) {
      reorderNodes(dragging, idx)
    }
    setDragging(null)
    setDragOver(null)
  }

  return (
    <div className="flex h-full flex-col border-r border-slate-700/50 bg-slate-900/50 w-56 shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/50">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Nodes</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-slate-400 hover:text-white"
              onClick={() => addNode()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Add new node</TooltipContent>
        </Tooltip>
      </div>

      {/* Node list */}
      <div className="flex-1 overflow-y-auto py-1">
        {nodes.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-4 text-center">
            <Box className="h-8 w-8 text-slate-600" />
            <p className="text-xs text-slate-500">No nodes yet.</p>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={() => addNode()}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Node
            </Button>
          </div>
        )}
        {nodes.map((node, idx) => (
          <div
            key={node.id}
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDrop={() => handleDrop(idx)}
            onDragEnd={() => { setDragging(null); setDragOver(null) }}
            className={cn(
              'group flex items-center gap-1.5 px-2 py-1.5 cursor-pointer select-none transition-colors mx-1 rounded-md',
              selectedNodeId === node.id
                ? 'bg-blue-600/20 text-blue-300'
                : 'text-slate-300 hover:bg-slate-800',
              dragOver === idx && dragging !== idx && 'border-t-2 border-blue-500'
            )}
            onClick={() => selectNode(node.id)}
          >
            <GripVertical className="drag-handle h-3.5 w-3.5 shrink-0 text-slate-600 group-hover:text-slate-500" />
            <span className="flex-1 truncate text-xs font-medium" title={node.displayName}>
              {node.displayName}
            </span>
            {/* Action buttons — shown on hover */}
            <div className="hidden group-hover:flex items-center gap-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="rounded p-0.5 text-slate-500 hover:text-slate-200 hover:bg-slate-700"
                    onClick={(e) => { e.stopPropagation(); duplicateNode(node.id) }}
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Duplicate</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="rounded p-0.5 text-slate-500 hover:text-red-400 hover:bg-slate-700"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (window.confirm(`Delete node "${node.displayName}"?`)) {
                        deleteNode(node.id)
                      }
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Delete</TooltipContent>
              </Tooltip>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom add button */}
      <div className="border-t border-slate-700/50 p-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full h-7 text-xs gap-1.5 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
          onClick={() => addNode()}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Node
        </Button>
      </div>
    </div>
  )
}
