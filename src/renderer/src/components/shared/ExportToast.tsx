import React, { useEffect, useRef, useState } from 'react'
import { Check, Copy, X } from 'lucide-react'
import { cn } from '../../lib/utils'

interface ExportToastProps {
  exportedPath: string | null
  onDismiss: () => void
}

export function ExportToast({ exportedPath, onDismiss }: ExportToastProps): JSX.Element | null {
  const [visible, setVisible] = useState(false)
  const [copied, setCopied] = useState(false)
  const hovered = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dismissedRef = useRef(false)

  function fadeOut(): void {
    setVisible(false)
    setTimeout(() => {
      if (!dismissedRef.current) {
        dismissedRef.current = true
        onDismiss()
      }
    }, 400)
  }

  function startAutoClose(ms = 5000): void {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      if (!hovered.current) fadeOut()
    }, ms)
  }

  useEffect(() => {
    if (!exportedPath) {
      setVisible(false)
      return
    }
    dismissedRef.current = false
    setCopied(false)
    hovered.current = false
    // Small delay so the element is mounted before starting the transition in
    const mountTimer = setTimeout(() => setVisible(true), 20)
    startAutoClose(5000)
    return () => {
      clearTimeout(mountTimer)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [exportedPath])

  function handleCopy(): void {
    if (!exportedPath) return
    navigator.clipboard.writeText(exportedPath).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!exportedPath) return null

  return (
    /* Full-screen overlay (pointer-events-none so clicks pass through) with centered card */
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div
        className={cn(
          'pointer-events-auto w-[44rem] max-w-[90vw] bg-slate-800/95 border border-green-700/40 rounded-xl shadow-2xl p-5',
          'transition-all duration-400 ease-out',
          visible
            ? 'opacity-100 scale-100'
            : 'opacity-0 scale-95'
        )}
        onMouseEnter={() => {
          hovered.current = true
          if (timerRef.current) clearTimeout(timerRef.current)
        }}
        onMouseLeave={() => {
          hovered.current = false
          startAutoClose(1500)
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <div className="h-9 w-9 rounded-full bg-green-900/50 border border-green-600/50 flex items-center justify-center shrink-0">
            <Check className="h-5 w-5 text-green-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-100">Export complete</p>
            <p className="text-xs text-slate-400">Files written to disk</p>
          </div>
          <button
            className="shrink-0 text-slate-500 hover:text-slate-300 transition-colors rounded p-0.5"
            onClick={fadeOut}
            title="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Path display */}
        <div className="bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-2.5">
          <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider mb-1">Export location</p>
          <p className="text-xs text-slate-300 font-mono break-all leading-relaxed">{exportedPath}</p>
        </div>

        {/* Copy button */}
        <button
          className="mt-3 w-full flex items-center justify-center gap-2 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700/40 transition-colors rounded-lg py-2"
          onClick={handleCopy}
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Path copied to clipboard!' : 'Copy path'}
        </button>
      </div>
    </div>
  )
}
