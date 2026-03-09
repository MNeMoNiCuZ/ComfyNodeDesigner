import React, { useState } from 'react'
import { COMFY_TYPE_INFO, getTypeInfo } from '../../lib/comfyTypes'
import type { ComfyType } from '../../types/node.types'
import { cn } from '../../lib/utils'
import { ChevronDown, Search } from 'lucide-react'

interface TypeSelectorProps {
  value: ComfyType
  onChange: (value: ComfyType) => void
  disabled?: boolean
  className?: string
}

export function TypeSelector({ value, onChange, disabled, className }: TypeSelectorProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const info = getTypeInfo(value)
  const filtered = COMFY_TYPE_INFO.filter(
    (t) =>
      t.label.toLowerCase().includes(search.toLowerCase()) ||
      t.type.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors hover:bg-accent/50 focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          open && 'ring-1 ring-ring'
        )}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <span
            className={cn(
              'shrink-0 rounded px-1.5 py-0.5 text-xs font-mono font-semibold border',
              info.bgColor,
              info.color
            )}
          >
            {value}
          </span>
          <span className="truncate text-muted-foreground text-xs">{info.label}</span>
        </div>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          {/* Dropdown */}
          <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[280px] rounded-md border border-slate-700 bg-slate-900 shadow-xl">
            {/* Search */}
            <div className="flex items-center border-b border-slate-700 px-3 py-2">
              <Search className="mr-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <input
                autoFocus
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                placeholder="Search types..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {/* List */}
            <div className="max-h-64 overflow-y-auto py-1">
              {filtered.length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">No types found</div>
              )}
              {filtered.map((t) => (
                <button
                  key={t.type}
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-slate-800 transition-colors',
                    value === t.type && 'bg-slate-800'
                  )}
                  onClick={() => {
                    onChange(t.type)
                    setOpen(false)
                    setSearch('')
                  }}
                  title={t.description}
                >
                  <span
                    className={cn(
                      'shrink-0 rounded px-1.5 py-0.5 text-xs font-mono font-semibold border w-32 text-center',
                      t.bgColor,
                      t.color
                    )}
                  >
                    {t.type}
                  </span>
                  <span className="truncate text-slate-300">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
