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

type ExportMode = 'single' | 'package'

export function ExportModal({ open, onClose }: ExportModalProps): JSX.Element {
  const { project } = useProjectStore()
  const [mode, setMode] = useState<ExportMode>('single')
  const [exporting, setExporting] = useState(false)

  const files = useMemo(
    () => generateAllFiles(project.nodes, project.name),
    [project.nodes, project.name]
  )

  async function handleExport(): Promise<void> {
    setExporting(true)
    try {
      await window.electronAPI.exportCode(project.nodes, mode, project.name)
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
              mode === 'single'
                ? 'border-blue-500 bg-blue-600/10 text-blue-300'
                : 'border-slate-700 hover:border-slate-600 text-slate-300'
            )}
            onClick={() => setMode('single')}
          >
            <FileCode className="h-6 w-6" />
            <div>
              <p className="text-sm font-semibold">Single .py file</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                One file with all nodes + mappings. Drop directly into <code className="font-mono">custom_nodes/</code>.
              </p>
              <p className="text-xs text-slate-500 mt-1 font-mono">
                {project.name}.py ({lineCount(files.singleFilePy)} lines)
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
            <FolderOpen className="h-6 w-6" />
            <div>
              <p className="text-sm font-semibold">Full package</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Folder with <code className="font-mono">__init__.py</code>, <code className="font-mono">nodes/</code> subfolder, <code className="font-mono">requirements.txt</code>, and <code className="font-mono">README.md</code>.
              </p>
              <p className="text-xs text-slate-500 mt-1 font-mono">
                {project.name}/ (4 files)
              </p>
            </div>
          </button>
        </div>

        {/* Preview of what will be exported */}
        <div className="rounded-lg bg-slate-800/40 border border-slate-700 p-3">
          <p className="text-xs font-semibold text-slate-300 mb-2">Will export:</p>
          {mode === 'single' ? (
            <ul className="text-xs text-slate-400 space-y-1 font-mono">
              <li>📄 {project.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.py</li>
            </ul>
          ) : (
            <ul className="text-xs text-slate-400 space-y-1 font-mono">
              <li>📁 {project.name.replace(/[^a-zA-Z0-9_-]/g, '_')}/</li>
              <li className="ml-4">📄 __init__.py</li>
              <li className="ml-4">📁 nodes/</li>
              <li className="ml-8">📄 {project.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_nodes.py</li>
              <li className="ml-4">📄 requirements.txt</li>
              <li className="ml-4">📄 README.md</li>
            </ul>
          )}
          <p className="text-xs text-slate-500 mt-2">
            {mode === 'single'
              ? 'You will be prompted to choose where to save the file.'
              : 'You will be prompted to choose a directory. A folder will be created inside it.'}
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
