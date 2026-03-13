import React, { useMemo, useState } from 'react'
import Editor from '@monaco-editor/react'
import { useProjectStore } from '../../store/projectStore'
import { useSettingsStore } from '../../store/settingsStore'
import { generateAllFiles } from '../../../../main/generators/codeGenerator'
import { Button } from '../ui/button'
import { Copy, Check, Download, Loader2 } from 'lucide-react'
import { ExportModal } from '../modals/ExportModal'
import type { ComfyNodeDef } from '../../types/node.types'

interface PreviewTabProps {
  node?: ComfyNodeDef | null
}

type ViewMode = 'node_file' | 'init_py_individual' | 'nodes_py' | 'init_py'

export function PreviewTab({ node }: PreviewTabProps = {}): JSX.Element {
  const { project } = useProjectStore()
  const { exportPath } = useSettingsStore()

  const defaultMode: ViewMode = node ? 'node_file' : 'nodes_py'
  const [mode, setMode] = useState<ViewMode>(defaultMode)
  const [copied, setCopied] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportDone, setExportDone] = useState(false)

  const sanitizedName = (project.packName ?? project.name).replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()

  // Always generate all project files so initPyIndividual has all nodes
  const files = useMemo(
    () => generateAllFiles(project.nodes, project.packName ?? project.name),
    [project.nodes, project.packName, project.name]
  )

  const code: string = (() => {
    switch (mode) {
      case 'node_file':
        return node ? (files.nodeFiles[node.internalName] ?? '# Node file not found\n') : files.nodeFiles[Object.keys(files.nodeFiles)[0]] ?? '# No nodes\n'
      case 'init_py_individual':
        return files.initPyIndividual
      case 'nodes_py':
        return files.nodesPy
      case 'init_py':
        return files.initPy
    }
  })()

  const fileLabel: string = (() => {
    switch (mode) {
      case 'node_file':
        return node ? `${node.internalName}.py` : `${sanitizedName}.py`
      case 'init_py_individual':
        return `${sanitizedName}/__init__.py`
      case 'nodes_py':
        return `${sanitizedName}/nodes/${sanitizedName}_nodes.py`
      case 'init_py':
        return `${sanitizedName}/__init__.py`
    }
  })()

  function handleCopy(): void {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleDirectExport(): Promise<void> {
    if (!exportPath || project.nodes.length === 0) return
    setExporting(true)
    try {
      await window.electronAPI.exportToPath(project.nodes, project.packName ?? project.name, exportPath)
      setExportDone(true)
      setTimeout(() => setExportDone(false), 2000)
    } catch {
      // Fall back to modal on error
      setExportOpen(true)
    } finally {
      setExporting(false)
    }
  }

  // Toolbar buttons depend on whether a node is provided
  const tabButtons: Array<{ key: ViewMode; label: string }> = node
    ? [
        { key: 'node_file', label: 'Node File' },
        { key: 'init_py_individual', label: '__init__.py' }
      ]
    : [
        { key: 'nodes_py', label: 'nodes.py' },
        { key: 'init_py', label: '__init__.py' }
      ]

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-slate-700/50 bg-slate-900/50 px-4 py-2">
        <div className="flex rounded-md overflow-hidden border border-slate-700">
          {tabButtons.map((tab) => (
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
          {exportPath ? (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs border-slate-700"
              onClick={handleDirectExport}
              disabled={exporting || project.nodes.length === 0}
              title={`Export to ${exportPath}`}
            >
              {exporting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : exportDone ? (
                <Check className="h-3.5 w-3.5 text-green-400" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {exportDone ? 'Exported!' : 'Export'}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs border-slate-700"
              onClick={() => setExportOpen(true)}
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
          )}
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
