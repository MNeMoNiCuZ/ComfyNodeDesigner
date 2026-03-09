import React, { useMemo, useState } from 'react'
import Editor from '@monaco-editor/react'
import { useProjectStore } from '../../store/projectStore'
import { generateAllFiles } from '../../../../main/generators/codeGenerator'
import { Button } from '../ui/button'
import { Copy, Check, Download } from 'lucide-react'
import { ExportModal } from '../modals/ExportModal'

type ViewMode = 'single' | 'nodes_py' | 'init_py'

export function PreviewTab(): JSX.Element {
  const { project } = useProjectStore()
  const [mode, setMode] = useState<ViewMode>('single')
  const [copied, setCopied] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)

  const sanitizedName = project.name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()

  const files = useMemo(
    () => generateAllFiles(project.nodes, project.name),
    [project.nodes, project.name]
  )

  const code =
    mode === 'single'
      ? files.singleFilePy
      : mode === 'nodes_py'
        ? files.nodesPy
        : files.initPy

  const fileLabel =
    mode === 'single'
      ? `${sanitizedName}.py`
      : mode === 'nodes_py'
        ? `${sanitizedName}/nodes/${sanitizedName}_nodes.py`
        : `${sanitizedName}/__init__.py`

  function handleCopy(): void {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-slate-700/50 bg-slate-900/50 px-4 py-2">
        <div className="flex rounded-md overflow-hidden border border-slate-700">
          {(
            [
              { key: 'single', label: 'Single File' },
              { key: 'nodes_py', label: 'nodes.py' },
              { key: 'init_py', label: '__init__.py' }
            ] as Array<{ key: ViewMode; label: string }>
          ).map((tab) => (
            <button
              key={tab.key}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === tab.key
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              onClick={() => setMode(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <span className="text-xs text-slate-500 font-mono truncate">{fileLabel}</span>

        <div className="flex-1" />

        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">
            {project.nodes.length} node{project.nodes.length !== 1 ? 's' : ''}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={handleCopy}
          >
            {copied ? (
              <><Check className="h-3.5 w-3.5 text-green-400" /> Copied</>
            ) : (
              <><Copy className="h-3.5 w-3.5" /> Copy</>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs border-slate-700"
            onClick={() => setExportOpen(true)}
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <Editor
          height="100%"
          language="python"
          theme="vs-dark"
          value={code}
          options={{
            readOnly: true,
            minimap: { enabled: true },
            fontSize: 13,
            lineNumbers: 'on',
            wordWrap: 'off',
            scrollBeyondLastLine: false,
            tabSize: 4,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
            renderLineHighlight: 'none'
          }}
        />
      </div>

      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  )
}
