import React from 'react'
import { FileCode, FolderArchive, X } from 'lucide-react'

interface ImportModalProps {
  open: boolean
  onClose: () => void
  onImportFile: () => void
  onImportFolder: () => void
}

export function ImportModal({ open, onClose, onImportFile, onImportFolder }: ImportModalProps): JSX.Element | null {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md p-6 z-10">
        <button
          className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition-colors"
          onClick={onClose}
          title="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <h2 className="text-base font-semibold text-slate-200 mb-1">Import Nodes</h2>
        <p className="text-xs text-muted-foreground mb-5">
          Choose how to import existing ComfyUI nodes into this project.
        </p>

        <div className="space-y-3">
          <button
            className="w-full text-left flex items-start gap-4 p-4 rounded-lg border border-slate-700 bg-slate-800/40 hover:bg-slate-800/80 hover:border-blue-700/60 transition-colors"
            onClick={() => { onClose(); onImportFile() }}
          >
            <FileCode className="h-8 w-8 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-slate-200 mb-1">Import Node File (.py)</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Import one or more nodes from a single Python file. Works with files containing a single node class or multiple node classes in one file.
              </p>
            </div>
          </button>

          <button
            className="w-full text-left flex items-start gap-4 p-4 rounded-lg border border-slate-700 bg-slate-800/40 hover:bg-slate-800/80 hover:border-purple-700/60 transition-colors"
            onClick={() => { onClose(); onImportFolder() }}
          >
            <FolderArchive className="h-8 w-8 text-purple-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-slate-200 mb-1">Import Node Pack (folder)</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Import all nodes from a ComfyUI custom node pack. Select the pack's root folder (e.g.{' '}
                <code className="font-mono bg-slate-700 px-1 rounded text-slate-300">ComfyUI_MyPack/</code>
                ) — all node files inside will be imported.
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
