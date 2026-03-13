import React, { useState, useMemo } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { generateAllFiles } from '../../../../main/generators/codeGenerator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '../ui/dialog'
import { Button } from '../ui/button'
import { FileCode, FolderOpen, Download, Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'

interface ExportModalProps {
  open: boolean
  onClose: () => void
}

type ExportMode = 'individual' | 'package'

export function ExportModal({ open, onClose }: ExportModalProps): JSX.Element {
  const { project } = useProjectStore()
  const [mode, setMode] = useState<ExportMode>('individual')
  const [exporting, setExporting] = useState(false)

  const packName = project.packName ?? project.name
  const files = useMemo(
    () => generateAllFiles(project.nodes, packName, project.name),
    [project.nodes, packName, project.name]
  )

  async function handleExport(): Promise<void> {
    setExporting(true)
    try {
      await window.electronAPI.exportCode(project.nodes, mode, packName)
      onClose()
    } catch (e) {
      if ((e as Error).message !== 'Export cancelled') {
        alert(`Export failed: ${(e as Error).message}`)
      }
    } finally {
      setExporting(false)
    }
  }

  const lineCount = (code: string): number => code.split('\n').length

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Export Code</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground -mt-2">
          Export your {project.nodes.length} node{project.nodes.length !== 1 ? 's' : ''} as Python code, ready to drop into ComfyUI's <code className="font-mono">custom_nodes/</code> folder.
        </p>

        {/* Mode selector */}
        <div className="grid grid-cols-2 gap-3">
          <button
            className={cn(
              'flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors',
              mode === 'individual'
                ? 'border-blue-500 bg-blue-600/10 text-blue-300'
                : 'border-slate-700 hover:border-slate-600 text-slate-300'
            )}
            onClick={() => setMode('individual')}
          >
            <FolderOpen className="h-6 w-6" />
            <div>
              <p className="text-sm font-semibold">Individual files (recommended)</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Each node gets its own <code className="font-mono">.py</code> file. Clean structure, easy to manage.
              </p>
              <p className="text-xs text-slate-500 mt-1 font-mono">
                {packName.replace(/[^a-zA-Z0-9_-]/g, '_')}/ ({project.nodes.length + 3} files)
              </p>
            </div>
          </button>

          <button
            className={cn(
              'flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors',
              mode === 'package'
                ? 'border-blue-500 bg-blue-600/10 text-blue-300'
                : 'border-slate-700 hover:border-slate-600 text-slate-300'
            )}
            onClick={() => setMode('package')}
          >
            <FileCode className="h-6 w-6" />
            <div>
              <p className="text-sm font-semibold">Full package (legacy)</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Folder with <code className="font-mono">__init__.py</code>, <code className="font-mono">nodes/</code> subfolder, <code className="font-mono">requirements.txt</code>, and <code className="font-mono">README.md</code>.
              </p>
              <p className="text-xs text-slate-500 mt-1 font-mono">
                {packName.replace(/[^a-zA-Z0-9_-]/g, '_')}/ (4 files)
              </p>
            </div>
          </button>
        </div>

        {/* Preview of what will be exported */}
        <div className="rounded-lg bg-slate-800/40 border border-slate-700 p-3">
          <p className="text-xs font-semibold text-slate-300 mb-2">Will export:</p>
          {mode === 'individual' ? (
            <ul className="text-xs text-slate-400 space-y-1 font-mono">
              <li>📁 {packName.replace(/[^a-zA-Z0-9_-]/g, '_')}/</li>
              <li className="ml-4">📄 __init__.py</li>
              <li className="ml-4">📁 nodes/</li>
              {project.nodes.map((n) => (
                <li key={n.id} className="ml-8">📄 {n.internalName}.py</li>
              ))}
              <li className="ml-4">📄 README.md</li>
            </ul>
          ) : (
            <ul className="text-xs text-slate-400 space-y-1 font-mono">
              <li>📁 {packName.replace(/[^a-zA-Z0-9_-]/g, '_')}/</li>
              <li className="ml-4">📄 __init__.py</li>
              <li className="ml-4">📁 nodes/</li>
              <li className="ml-8">📄 {packName.replace(/[^a-zA-Z0-9_-]/g, '_')}_nodes.py</li>
              <li className="ml-4">📄 requirements.txt</li>
              <li className="ml-4">📄 README.md</li>
            </ul>
          )}
          <p className="text-xs text-slate-500 mt-2">
            {mode === 'individual'
              ? 'Point the picker at your ComfyUI/custom_nodes/ folder — the pack folder will be created inside it automatically.'
              : 'Point the picker at your ComfyUI/custom_nodes/ folder — the pack folder will be created inside it automatically. Uses legacy nodes/ subfolder structure.'}
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={exporting}>Cancel</Button>
          <Button
            onClick={handleExport}
            disabled={exporting || project.nodes.length === 0}
            className="gap-2"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {exporting ? 'Exporting…' : 'Export'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
