import React, { useState, useEffect } from 'react'
import type { NodeInput, ComfyType } from '../../types/node.types'
import { createDefaultInput } from '../../types/node.types'
import { COMFY_TYPE_INFO } from '../../lib/comfyTypes'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Switch } from '../ui/switch'
import { TypeSelector } from '../shared/TypeSelector'
import { FieldLabel } from '../shared/TooltipWrapper'

interface InputEditModalProps {
  open: boolean
  input?: NodeInput
  onSave: (input: NodeInput) => void
  onClose: () => void
}

const WIDGET_TYPES = new Set<ComfyType>(['INT', 'FLOAT', 'STRING', 'BOOLEAN', 'COMBO'])

export function InputEditModal({ open, input, onSave, onClose }: InputEditModalProps): JSX.Element {
  const isNew = !input
  const [draft, setDraft] = useState<NodeInput>(() =>
    input ? { ...input, widget: input.widget ? { ...input.widget } : undefined } : createDefaultInput()
  )
  const [comboOptionsText, setComboOptionsText] = useState(
    input?.widget?.comboOptions?.join('\n') ?? ''
  )

  useEffect(() => {
    if (input) {
      setDraft({ ...input, widget: input.widget ? { ...input.widget } : undefined })
      setComboOptionsText(input.widget?.comboOptions?.join('\n') ?? '')
    } else {
      const d = createDefaultInput()
      setDraft(d)
      setComboOptionsText('')
    }
  }, [input, open])

  const typeInfo = COMFY_TYPE_INFO.find((t) => t.type === draft.type)
  const isWidgetType = WIDGET_TYPES.has(draft.type)

  function setType(type: ComfyType): void {
    const newIsWidget = WIDGET_TYPES.has(type)
    setDraft((d) => ({
      ...d,
      type,
      widget: newIsWidget ? (d.widget ?? {}) : undefined,
      forceInput: newIsWidget ? d.forceInput : false
    }))
  }

  function setWidget(updates: Partial<NonNullable<NodeInput['widget']>>): void {
    setDraft((d) => ({ ...d, widget: { ...d.widget, ...updates } }))
  }

  function handleSave(): void {
    const toSave = { ...draft }
    if (draft.type === 'COMBO' && toSave.widget) {
      toSave.widget.comboOptions = comboOptionsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
    }
    onSave(toSave)
  }

  const canSave = draft.name.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isNew ? 'Add Input' : 'Edit Input'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <FieldLabel
              label="Name"
              tooltip="Python parameter name. Used as the variable name in execute(). Must be a valid Python identifier."
              required
            />
            <Input
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              className="font-mono"
              placeholder="input_name"
              autoFocus
            />
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <FieldLabel
              label="Type"
              tooltip="The ComfyUI data type for this input. Widget types (INT, FLOAT, STRING, BOOLEAN, COMBO) render as UI controls; all others are connection sockets."
              required
            />
            <TypeSelector value={draft.type} onChange={setType} />
            {typeInfo && (
              <p className="text-xs text-slate-500">{typeInfo.description}</p>
            )}
          </div>

          {/* Required toggle */}
          <div className="flex items-center justify-between">
            <FieldLabel
              label="Required"
              tooltip="If required, this input must be connected. If optional, it can be left disconnected (needs a default value or forceInput=False)."
            />
            <Switch
              checked={draft.required}
              onCheckedChange={(checked) => setDraft((d) => ({ ...d, required: checked }))}
            />
          </div>

          {/* Tooltip */}
          <div className="space-y-1.5">
            <FieldLabel
              label="Tooltip"
              tooltip="Description shown on hover in the ComfyUI UI and generated in code comments."
            />
            <Input
              value={draft.tooltip ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, tooltip: e.target.value }))}
              placeholder="Describe this input…"
            />
          </div>

          {/* Widget-specific config */}
          {isWidgetType && (
            <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-3 space-y-3">
              <p className="text-xs font-semibold text-slate-300">Widget Configuration</p>

              {(draft.type === 'INT' || draft.type === 'FLOAT') && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <FieldLabel label="Default" tooltip="Default value when not connected." />
                    <Input
                      type="number"
                      value={draft.widget?.default as number ?? ''}
                      onChange={(e) => setWidget({ default: e.target.value ? Number(e.target.value) : undefined })}
                      className="h-8 text-sm mt-1"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <FieldLabel label="Min" tooltip="Minimum allowed value." />
                    <Input
                      type="number"
                      value={draft.widget?.min ?? ''}
                      onChange={(e) => setWidget({ min: e.target.value ? Number(e.target.value) : undefined })}
                      className="h-8 text-sm mt-1"
                      placeholder="—"
                    />
                  </div>
                  <div>
                    <FieldLabel label="Max" tooltip="Maximum allowed value." />
                    <Input
                      type="number"
                      value={draft.widget?.max ?? ''}
                      onChange={(e) => setWidget({ max: e.target.value ? Number(e.target.value) : undefined })}
                      className="h-8 text-sm mt-1"
                      placeholder="—"
                    />
                  </div>
                  <div>
                    <FieldLabel label="Step" tooltip="Increment step for the slider/input." />
                    <Input
                      type="number"
                      value={draft.widget?.step ?? ''}
                      onChange={(e) => setWidget({ step: e.target.value ? Number(e.target.value) : undefined })}
                      className="h-8 text-sm mt-1"
                      placeholder="1"
                    />
                  </div>
                  {draft.type === 'FLOAT' && (
                    <div>
                      <FieldLabel label="Round" tooltip="Round to this many decimal places for display." />
                      <Input
                        type="number"
                        value={draft.widget?.round ?? ''}
                        onChange={(e) => setWidget({ round: e.target.value ? Number(e.target.value) : undefined })}
                        className="h-8 text-sm mt-1"
                        placeholder="0.01"
                      />
                    </div>
                  )}
                </div>
              )}

              {draft.type === 'STRING' && (
                <div className="space-y-2">
                  <div>
                    <FieldLabel label="Default" tooltip="Default string value." />
                    <Input
                      value={draft.widget?.default as string ?? ''}
                      onChange={(e) => setWidget({ default: e.target.value })}
                      className="h-8 text-sm mt-1"
                      placeholder=""
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <FieldLabel label="Multiline" tooltip="Show as a multiline textarea instead of single-line input." />
                    <Switch
                      checked={draft.widget?.multiline ?? false}
                      onCheckedChange={(checked) => setWidget({ multiline: checked })}
                    />
                  </div>
                </div>
              )}

              {draft.type === 'BOOLEAN' && (
                <div>
                  <FieldLabel label="Default value" tooltip="Default boolean value." />
                  <div className="flex items-center gap-3 mt-1">
                    <Switch
                      checked={draft.widget?.default as boolean ?? false}
                      onCheckedChange={(checked) => setWidget({ default: checked })}
                    />
                    <span className="text-sm text-slate-300">
                      {draft.widget?.default ? 'True' : 'False'}
                    </span>
                  </div>
                </div>
              )}

              {draft.type === 'COMBO' && (
                <div className="space-y-2">
                  <FieldLabel
                    label="Options (one per line)"
                    tooltip="The dropdown options. The first option is the default unless overridden."
                    required
                  />
                  <Textarea
                    value={comboOptionsText}
                    onChange={(e) => setComboOptionsText(e.target.value)}
                    className="h-24 font-mono text-sm resize-none"
                    placeholder="option_one&#10;option_two&#10;option_three"
                  />
                  <p className="text-xs text-slate-500">
                    {comboOptionsText.split('\n').filter((s) => s.trim()).length} options
                  </p>
                </div>
              )}

              {/* Force input for widget types */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-700">
                <FieldLabel
                  label="forceInput"
                  tooltip="If enabled, this widget type will always show as a socket (connection point) instead of an inline control, even though it's a widget type. Useful when you want to pass a value from another node."
                />
                <Switch
                  checked={draft.forceInput ?? false}
                  onCheckedChange={(checked) => setDraft((d) => ({ ...d, forceInput: checked }))}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {isNew ? 'Add Input' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
