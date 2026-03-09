import React from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { HelpCircle } from 'lucide-react'
import { cn } from '../../lib/utils'

interface TooltipWrapperProps {
  children: React.ReactNode
  tooltip?: string
  className?: string
  side?: 'top' | 'bottom' | 'left' | 'right'
}

export function TooltipWrapper({ children, tooltip, className, side = 'top' }: TooltipWrapperProps): JSX.Element {
  if (!tooltip) return <>{children}</>
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn('flex items-center gap-1', className)}>{children}</span>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  )
}

interface FieldLabelProps {
  label: string
  tooltip?: string
  required?: boolean
  className?: string
}

export function FieldLabel({ label, tooltip, required, className }: FieldLabelProps): JSX.Element {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      <span className="text-sm font-medium text-slate-200">
        {label}
        {required && <span className="ml-0.5 text-red-400">*</span>}
      </span>
      {tooltip && (
        <Tooltip>
          <TooltipTrigger asChild>
            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground hover:text-slate-300 cursor-help transition-colors" />
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}
