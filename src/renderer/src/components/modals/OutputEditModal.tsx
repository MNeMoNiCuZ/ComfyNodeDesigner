import React, { useState, useEffect } from 'react'
import type { NodeOutput, ComfyType } from '../../types/node.types'
import { createDefaultOutput } from '../../types/node.types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { TypeSelector } from '../shared/TypeSelector'
import { FieldLabel } from '../shared/TooltipWrapper'

interface OutputEditModalProps {
  open: boolean
  output?: NodeOutput
  onSave: (output: NodeOutput) => void
  onClose: () => void
}

export function OutputEditModal({ open, output, onSave, onClose }: OutputEditModalProps): JSX.Element {
  const isNew = !output
  const [draft, setDraft] = useState<NodeOutput>(() =>
    output ? { ...output } : createDefaultOutput()
  )

  useEffect(() => {
    if (output) {
      setDraft({ ...output })
    } else {
      setDraft(createDefaultOutput())
    }
  }, [output, open])

  function handleSave(): void {
    onSave(draft)
  }

  const canSave = draft.name.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isNew ? 'Add Output' : 'Edit Output'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={(e) => { e.preventDefault(); if (canSave) handleSave() }} className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <FieldLabel
              label="Name"
              tooltip="Python return name. Used in RETURN_NAMES and as the socket label in ComfyUI."
              required
            />
            <Input
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              className="font-mono"
              placeholder="output_name"
              autoFocus
            />
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <FieldLabel
              label="Type"
              tooltip="The ComfyUI data type this output produces. Must match what your execute() method returns in that tuple position."
              required
            />
            <TypeSelector
              value={draft.type}
              onChange={(type: ComfyType) => setDraft((d) => ({ ...d, type }))}
            />
          </div>

          {/* Tooltip */}
          <div className="space-y-1.5">
            <FieldLabel
              label="Tooltip"
              tooltip="Description shown on hover in the ComfyUI UI."
            />
            <Input
              value={draft.tooltip ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, tooltip: e.target.value }))}
              placeholder="Describe this output…"
            />
          </div>
        </form>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} type="button">Cancel</Button>
          <Button onClick={handleSave} disabled={!canSave} type="button">
            {isNew ? 'Add Output' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
