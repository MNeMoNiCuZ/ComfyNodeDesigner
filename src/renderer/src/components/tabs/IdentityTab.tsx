import React, { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { ComfyNodeDef } from '../../types/node.types'
import { useProjectStore } from '../../store/projectStore'
import { useSettingsStore } from '../../store/settingsStore'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Label } from '../ui/label'
import { Switch } from '../ui/switch'
import { FieldLabel } from '../shared/TooltipWrapper'
import { SUGGESTED_CATEGORIES } from '../../lib/comfyTypes'
import { isValidSnakeCase, toSnakeCase } from '../../lib/utils'
import { AlertCircle, RefreshCw, ChevronDown } from 'lucide-react'

const schema = z.object({
  internalName: z
    .string()
    .min(1, 'Required')
    .refine(isValidSnakeCase, 'Must be snake_case (lowercase letters, numbers, underscores)'),
  displayName: z.string().min(1, 'Required'),
  category: z.string().min(1, 'Required'),
  description: z.string().optional(),
  functionName: z
    .string()
    .min(1, 'Required')
    .refine(isValidSnakeCase, 'Must be a valid Python identifier'),
  usePackFolder: z.boolean()
})

type FormData = z.infer<typeof schema>

interface IdentityTabProps {
  node: ComfyNodeDef
}

// ---------------------------------------------------------------------------
// CategoryCombobox — always-show dropdown with free-form text input
// ---------------------------------------------------------------------------

interface CategoryComboboxProps {
  value: string
  onChange: (value: string) => void
  suggestions: string[]
}

function CategoryCombobox({ value, onChange, suggestions }: CategoryComboboxProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <div className="flex">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setOpen(true)
            } else if (e.key === 'Escape') {
              setOpen(false)
            }
          }}
          placeholder="custom"
          className="flex-1 rounded-r-none"
        />
        <button
          type="button"
          className="flex items-center justify-center px-2 border border-l-0 border-input bg-background rounded-r-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          onClick={() => setOpen((o) => !o)}
          tabIndex={-1}
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-slate-700 bg-slate-800 shadow-lg overflow-auto max-h-52">
          {suggestions.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-700 transition-colors ${value === cat ? 'text-blue-400 bg-slate-700/50' : 'text-slate-300'}`}
              onClick={() => {
                onChange(cat)
                setOpen(false)
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function IdentityTab({ node }: IdentityTabProps): JSX.Element {
  const { updateNode, project } = useProjectStore()
  const { pendingProposal } = useSettingsStore()
  const packName = (project.packName ?? 'ComfyUI_').replace(/[^a-zA-Z0-9_-]/g, '_')

  // Find any set_identity op in the pending proposal for this node
  const activeProposal = pendingProposal?.nodeId === node.id ? pendingProposal : null
  const identityOp = activeProposal?.operations.find(
    (op: any) => op.op === 'set_identity' && !op._invalid
  ) ?? null

  const IDENTITY_FIELD_LABELS: Record<string, string> = {
    displayName: 'Display Name',
    internalName: 'Internal Name',
    category: 'Category',
    description: 'Description',
    functionName: 'Execute Function Name',
    usePackFolder: 'Include in pack folder'
  }

  // Track whether the internal name should auto-sync from the display name.
  // Starts true; flips to false when the user directly edits the internal name field.
  const internalSynced = useRef(true)

  const {
    register,
    watch,
    setValue,
    formState: { errors }
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      internalName: node.internalName,
      displayName: node.displayName,
      category: node.category ?? '',
      description: node.description ?? '',
      functionName: node.functionName,
      usePackFolder: node.usePackFolder ?? true
    }
  })

  // Reset form and re-enable auto-sync when node changes
  useEffect(() => {
    internalSynced.current = true
    setValue('internalName', node.internalName)
    setValue('displayName', node.displayName)
    setValue('category', node.category ?? '')
    setValue('description', node.description ?? '')
    setValue('functionName', node.functionName)
    setValue('usePackFolder', node.usePackFolder ?? true)
  }, [node.id])

  // Auto-save on change — only when values actually differ from the node
  const watchedValues = watch()
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!errors.internalName && !errors.displayName && !errors.category && !errors.functionName) {
        const hasChanges =
          watchedValues.internalName !== node.internalName ||
          watchedValues.displayName !== node.displayName ||
          watchedValues.category !== node.category ||
          (watchedValues.description ?? '') !== (node.description ?? '') ||
          watchedValues.functionName !== node.functionName ||
          (watchedValues.usePackFolder ?? true) !== (node.usePackFolder ?? true)

        if (hasChanges) {
          updateNode(node.id, {
            internalName: watchedValues.internalName,
            displayName: watchedValues.displayName,
            category: watchedValues.category,
            description: watchedValues.description,
            functionName: watchedValues.functionName,
            usePackFolder: watchedValues.usePackFolder ?? true
          })
        }
      }
    }, 300)
    return () => clearTimeout(timeout)
  }, [watchedValues.internalName, watchedValues.displayName, watchedValues.category, watchedValues.description, watchedValues.functionName, watchedValues.usePackFolder, node.internalName, node.displayName, node.category, node.description, node.functionName, node.usePackFolder])

  // Check for name conflicts
  const nameConflict = project.nodes.some(
    (n) => n.id !== node.id && n.internalName === watchedValues.internalName
  )

  // Whether the internal name diverges from what would be auto-generated
  const autoGenerated = toSnakeCase(watchedValues.displayName)
  const internalDiverged = !internalSynced.current && watchedValues.internalName !== autoGenerated

  return (
    <div className="p-6 space-y-5 max-w-2xl">
      {/* AI Proposal banner for set_identity */}
      {identityOp && (
        <div className="rounded-lg border border-amber-700/50 bg-amber-950/40 px-4 py-3 space-y-2">
          <p className="text-xs font-semibold text-amber-300 uppercase tracking-wide">AI proposes Node Settings changes:</p>
          <div className="space-y-1">
            {(Object.keys(IDENTITY_FIELD_LABELS) as string[])
              .filter((f) => identityOp[f] !== undefined)
              .map((f) => {
                const oldVal = String((node as any)[f] ?? '')
                const newVal = String(identityOp[f] ?? '')
                return (
                  <div key={f} className="flex items-center gap-2 text-xs">
                    <span className="text-amber-400 font-medium w-36 shrink-0">{IDENTITY_FIELD_LABELS[f]}:</span>
                    <span className="text-slate-500 line-through truncate max-w-[120px]">{oldVal || '—'}</span>
                    <span className="text-amber-200 shrink-0">→</span>
                    <span className="text-amber-100 font-mono truncate">{newVal}</span>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      <div className="space-y-1">
        <h2 className="text-base font-semibold text-slate-200">Node Identity</h2>
        <p className="text-xs text-muted-foreground">
          Configure the name, category and description of this node.
        </p>
      </div>

      {/* Display Name — first, human-friendly */}
      <div className="space-y-1.5">
        <FieldLabel
          label="Display Name"
          tooltip="Human-readable name shown in the ComfyUI node menu and Add Node panel. Can contain spaces and capitals."
          required
        />
        <Input
          {...register('displayName')}
          placeholder="My Custom Node"
          onChange={(e) => {
            setValue('displayName', e.target.value)
            // Auto-sync internal name while the user hasn't manually edited it
            if (internalSynced.current) {
              setValue('internalName', toSnakeCase(e.target.value))
            }
          }}
        />
        {errors.displayName && (
          <p className="flex items-center gap-1 text-xs text-red-400">
            <AlertCircle className="h-3 w-3" />
            {errors.displayName.message}
          </p>
        )}
      </div>

      {/* Internal Name */}
      <div className="space-y-1.5">
        <FieldLabel
          label="Internal Name"
          tooltip="Python class name used in NODE_CLASS_MAPPINGS and as the class identifier in the generated code. Must be snake_case. Auto-filled from the Display Name above — edit here to customise."
          required
        />
        <div className="flex gap-2">
          <Input
            {...register('internalName')}
            placeholder="my_custom_node"
            className="font-mono flex-1"
            onChange={(e) => {
              internalSynced.current = false
              setValue('internalName', e.target.value)
            }}
          />
          {internalDiverged && (
            <button
              type="button"
              title="Re-sync internal name from display name"
              className="shrink-0 flex items-center gap-1 px-2 py-1 rounded border border-slate-700 text-xs text-slate-400 hover:text-slate-200 hover:border-slate-600"
              onClick={() => {
                internalSynced.current = true
                setValue('internalName', autoGenerated)
              }}
            >
              <RefreshCw className="h-3 w-3" />
              Sync
            </button>
          )}
        </div>
        {errors.internalName && (
          <p className="flex items-center gap-1 text-xs text-red-400">
            <AlertCircle className="h-3 w-3" />
            {errors.internalName.message}
          </p>
        )}
        {nameConflict && (
          <p className="flex items-center gap-1 text-xs text-amber-400">
            <AlertCircle className="h-3 w-3" />
            Another node already uses this internal name
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Tip: add a unique pack prefix, e.g. <code className="text-xs bg-slate-800 px-1 rounded">mypack_node_name</code>
        </p>
      </div>

      {/* Category */}
      <div className="space-y-1.5">
        <FieldLabel
          label="Category"
          tooltip="Where the node appears in the ComfyUI Add Node menu. Use forward-slashes for subcategories (e.g. 'image/filters'). Nodes with the same category are grouped together. The 'Include in pack folder' toggle below will prefix this with your pack name."
          required
        />
        <CategoryCombobox
          value={watchedValues.category}
          onChange={(val) => setValue('category', val)}
          suggestions={SUGGESTED_CATEGORIES}
        />
        {errors.category && (
          <p className="flex items-center gap-1 text-xs text-red-400">
            <AlertCircle className="h-3 w-3" />
            {errors.category.message}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Examples: <code className="text-xs bg-slate-800 px-1 rounded">image</code>,{' '}
          <code className="text-xs bg-slate-800 px-1 rounded">image/transform</code>,{' '}
          <code className="text-xs bg-slate-800 px-1 rounded">sampling</code>
        </p>

        {/* Pack folder option */}
        <div className="flex items-center justify-between rounded-md border border-slate-700/60 bg-slate-800/30 px-3 py-2 mt-1">
          <div className="space-y-0.5">
            <Label className="text-xs text-slate-300 cursor-pointer" htmlFor="use-pack-folder">
              Include in pack folder
            </Label>
            <p className="text-xs text-muted-foreground">
              Node will appear under{' '}
              <code className="bg-slate-800 px-1 rounded text-slate-300">
                {watchedValues.usePackFolder
                  ? `${packName}/${watchedValues.category || 'custom'}`
                  : watchedValues.category || 'custom'}
              </code>{' '}
              in the Add Node menu.
            </p>
          </div>
          <Switch
            id="use-pack-folder"
            checked={watchedValues.usePackFolder ?? true}
            onCheckedChange={(checked) => setValue('usePackFolder', checked)}
          />
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <FieldLabel
          label="Description"
          tooltip="Optional description for this node. Used in the generated README and as a comment above the class in the generated Python file."
        />
        <Textarea
          {...register('description')}
          placeholder="Describe what this node does…"
          className="resize-none h-20"
        />
      </div>

      {/* Execute Function Name */}
      <div className="space-y-1.5">
        <FieldLabel
          label="Execute Function Name"
          tooltip="The name of the Python method that ComfyUI calls to run this node. Set via FUNCTION = '...' in the class. Almost always 'execute' — only change this if you have a specific reason."
          required
        />
        <Input
          {...register('functionName')}
          placeholder="execute"
          className="font-mono max-w-xs"
        />
        {errors.functionName && (
          <p className="flex items-center gap-1 text-xs text-red-400">
            <AlertCircle className="h-3 w-3" />
            {errors.functionName.message}
          </p>
        )}
      </div>
    </div>
  )
}
