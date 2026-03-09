import React from 'react'
import { getTypeInfo } from '../../lib/comfyTypes'
import type { ComfyType } from '../../types/node.types'
import { cn } from '../../lib/utils'

interface TypeBadgeProps {
  type: ComfyType
  className?: string
  showLabel?: boolean
}

export function TypeBadge({ type, className, showLabel = false }: TypeBadgeProps): JSX.Element {
  const info = getTypeInfo(type)
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-xs font-mono font-semibold border',
        info.bgColor,
        info.color,
        className
      )}
      title={info.description}
    >
      {type}
      {showLabel && type !== info.label && (
        <span className="ml-1 font-sans font-normal opacity-70">({info.label})</span>
      )}
    </span>
  )
}

interface CodeProps {
  children: React.ReactNode
  className?: string
}

export function Code({ children, className }: CodeProps): JSX.Element {
  return (
    <code
      className={cn(
        'rounded bg-slate-800 px-1.5 py-0.5 text-xs font-mono text-slate-200 border border-slate-700',
        className
      )}
    >
      {children}
    </code>
  )
}
