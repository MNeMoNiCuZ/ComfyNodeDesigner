import React, { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { ComfyNodeDef } from '../../types/node.types'
import { useProjectStore } from '../../store/projectStore'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Label } from '../ui/label'
import { FieldLabel } from '../shared/TooltipWrapper'
import { SUGGESTED_CATEGORIES } from '../../lib/comfyTypes'
import { isValidSnakeCase, toSnakeCase } from '../../lib/utils'
import { AlertCircle } from 'lucide-react'

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
    .refine(isValidSnakeCase, 'Must be a valid Python identifier')
})

type FormData = z.infer<typeof schema>

interface IdentityTabProps {
  node: ComfyNodeDef
}

export function IdentityTab({ node }: IdentityTabProps): JSX.Element {
  const { updateNode, project } = useProjectStore()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      internalName: node.internalName,
      displayName: node.displayName,
      category: node.category,
      description: node.description ?? '',
      functionName: node.functionName
    }
  })

  // Reset form when node changes
  useEffect(() => {
    setValue('internalName', node.internalName)
    setValue('displayName', node.displayName)
    setValue('category', node.category)
    setValue('description', node.description ?? '')
    setValue('functionName', node.functionName)
  }, [node.id])

  // Auto-save on change
  const watchedValues = watch()
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!errors.internalName && !errors.displayName && !errors.category && !errors.functionName) {
        updateNode(node.id, {
          internalName: watchedValues.internalName,
          displayName: watchedValues.displayName,
          category: watchedValues.category,
          description: watchedValues.description,
          functionName: watchedValues.functionName
        })
      }
    }, 300)
    return () => clearTimeout(timeout)
  }, [watchedValues.internalName, watchedValues.displayName, watchedValues.category, watchedValues.description, watchedValues.functionName])

  // Check for name conflicts
  const nameConflict = project.nodes.some(
    (n) => n.id !== node.id && n.internalName === watchedValues.internalName
  )

  return (
    <div className="p-6 space-y-5 max-w-2xl">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-slate-200">Node Identity</h2>
        <p className="text-xs text-muted-foreground">
          Configure the name, category and description of this node.
        </p>
      </div>

      {/* Internal Name */}
      <div className="space-y-1.5">
        <FieldLabel
          label="Internal Name"
          tooltip="Python class name. Used in NODE_CLASS_MAPPINGS and as the class identifier. Must be snake_case."
          required
        />
        <Input
          {...register('internalName')}
          placeholder="my_custom_node"
          className="font-mono"
          onChange={(e) => {
            const raw = e.target.value
            setValue('internalName', raw)
          }}
        />
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
          Tip: use a unique prefix, e.g. <code className="text-xs bg-slate-800 px-1 rounded">mypack_</code>
        </p>
      </div>

      {/* Display Name */}
      <div className="space-y-1.5">
        <FieldLabel
          label="Display Name"
          tooltip="Human-readable name shown in the ComfyUI node menu. Can contain spaces and capitals."
          required
        />
        <Input
          {...register('displayName')}
          placeholder="My Custom Node"
          onChange={(e) => {
            setValue('displayName', e.target.value)
            // Auto-suggest internal name if not yet customized
            const currentInternal = watchedValues.internalName
            if (!currentInternal || currentInternal === 'my_custom_node') {
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

      {/* Category */}
      <div className="space-y-1.5">
        <FieldLabel
          label="Category"
          tooltip="Where the node appears in the ComfyUI Add Node menu. Use slashes for subcategories, e.g. 'image/filters'. Keep it consistent with other nodes in the same pack."
          required
        />
        <div className="relative">
          <Input
            {...register('category')}
            placeholder="custom"
            list="category-suggestions"
          />
          <datalist id="category-suggestions">
            {SUGGESTED_CATEGORIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        {errors.category && (
          <p className="flex items-center gap-1 text-xs text-red-400">
            <AlertCircle className="h-3 w-3" />
            {errors.category.message}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Examples: <code className="text-xs bg-slate-800 px-1 rounded">image</code>,{' '}
          <code className="text-xs bg-slate-800 px-1 rounded">image/transform</code>,{' '}
          <code className="text-xs bg-slate-800 px-1 rounded">MyPack/utils</code>
        </p>
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <FieldLabel
          label="Description"
          tooltip="Optional description for this node. Used in the generated README and as a code comment."
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
          tooltip="The name of the Python method that ComfyUI calls to run this node. Almost always 'execute'. Change only if you have a specific reason."
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
