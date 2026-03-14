import React, { useMemo, useState, useEffect } from 'react'
import Editor, { DiffEditor } from '@monaco-editor/react'
import { useProjectStore } from '../../store/projectStore'
import { useSettingsStore } from '../../store/settingsStore'
import { generateAllFiles } from '../../../../main/generators/codeGenerator'
import { applyOperations } from '../../lib/nodeOperations'
import { parseNodeCode } from '../../lib/codeParser'
import { Button } from '../ui/button'
import { Diff, Save, X, Lock } from 'lucide-react'
import type { ComfyNodeDef } from '../../types/node.types'

interface PreviewTabProps {
  node?: ComfyNodeDef | null
}

type ViewMode = 'node_file' | 'init_py_individual' | 'nodes_py' | 'init_py'


export function PreviewTab({ node }: PreviewTabProps = {}): JSX.Element {
  const { project, updateNode } = useProjectStore()
  const { pendingProposal } = useSettingsStore()

  const defaultMode: ViewMode = node ? 'node_file' : 'nodes_py'
  const [mode, setMode] = useState<ViewMode>(defaultMode)
  const [editedCode, setEditedCode] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const sanitizedName = (project.packName ?? project.name).replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()

  // Substitute proposed node when a pending proposal exists
  const previewNodes = useMemo(() => {
    if (!pendingProposal) return project.nodes
    const idx = project.nodes.findIndex((n) => n.id === pendingProposal.nodeId)
    if (idx === -1) return project.nodes
    const target = project.nodes[idx]
    const validOps = (pendingProposal.operations ?? []).filter((op: any) => !op._invalid)
    if (validOps.length === 0) return project.nodes
    const result = applyOperations(target, validOps)
    if ('error' in result) return project.nodes
    const updated = [...project.nodes]
    updated[idx] = { ...target, ...result.updates }
    return updated
  }, [project.nodes, pendingProposal])

  // Always generate all project files so initPyIndividual has all nodes
  const files = useMemo(
    () => generateAllFiles(previewNodes, project.packName ?? project.name),
    [previewNodes, project.packName, project.name]
  )

  // Original files (current committed state, no proposal applied)
  const originalFiles = useMemo(
    () => generateAllFiles(project.nodes, project.packName ?? project.name),
    [project.nodes, project.packName, project.name]
  )

  // Use the proposed node's internalName if there's a pending proposal for the current node
  const displayNode = node && pendingProposal?.nodeId === node.id
    ? (previewNodes.find((n) => n.id === node.id) ?? node)
    : node

  const hasPendingForThisNode = !!(pendingProposal && (!node || pendingProposal.nodeId === node.id))

  // Editable only in node_file mode with no pending proposal
  const isEditable = mode === 'node_file' && !hasPendingForThisNode && !!node

  // Reset edits when switching mode or node
  useEffect(() => {
    setEditedCode(null)
    setSaveError(null)
  }, [mode, node?.id])

  function getCode(f: ReturnType<typeof generateAllFiles>): string {
    switch (mode) {
      case 'node_file':
        return displayNode ? (f.nodeFiles[displayNode.internalName] ?? '# Node file not found\n') : f.nodeFiles[Object.keys(f.nodeFiles)[0]] ?? '# No nodes\n'
      case 'init_py_individual':
        return f.initPyIndividual
      case 'nodes_py':
        return f.nodesPy
      case 'init_py':
        return f.initPy
    }
  }

  const code = getCode(files)
  const originalCode = getCode(originalFiles)
  const showDiff = hasPendingForThisNode && originalCode !== code

  const isDirty = editedCode !== null && editedCode !== code

  const fileLabel: string = (() => {
    switch (mode) {
      case 'node_file':
        return displayNode ? `${displayNode.internalName}.py` : `${sanitizedName}.py`
      case 'init_py_individual':
        return `${sanitizedName}/__init__.py`
      case 'nodes_py':
        return `${sanitizedName}/nodes/${sanitizedName}_nodes.py`
      case 'init_py':
        return `${sanitizedName}/__init__.py`
    }
  })()

  function handleSaveEdit(): void {
    if (!editedCode || !node) return
    setSaveError(null)
    const parsed = parseNodeCode(editedCode, node)
    if (!parsed) {
      setSaveError('Could not parse inputs, outputs, or function body from the edited code')
      return
    }
    updateNode(node.id, {
      inputs: parsed.inputs,
      outputs: parsed.outputs,
      executeBody: parsed.executeBody
    })
    setEditedCode(null)
  }

  function handleDiscardEdit(): void {
    setEditedCode(null)
    setSaveError(null)
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

        {showDiff && (
          <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-900/30 border border-amber-700/40 px-2 py-0.5 rounded">
            <Diff className="h-3 w-3" />
            Proposal diff
          </span>
        )}

        {hasPendingForThisNode && !showDiff && (
          <span className="flex items-center gap-1 text-[10px] text-slate-500 bg-slate-800/60 border border-slate-700/40 px-2 py-0.5 rounded">
            <Lock className="h-3 w-3" />
            Locked — accept or reject proposal to edit
          </span>
        )}

        {saveError && (
          <span className="text-[10px] text-red-400 truncate max-w-xs">{saveError}</span>
        )}

        <div className="flex-1" />

        {isDirty && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs text-slate-400 hover:text-slate-200"
              onClick={handleDiscardEdit}
            >
              <X className="h-3.5 w-3.5" />
              Discard
            </Button>
            <Button
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={handleSaveEdit}
            >
              <Save className="h-3.5 w-3.5" />
              Save
            </Button>
          </div>
        )}
      </div>

      {/* Editor / Diff Editor */}
      <div className="flex-1 overflow-hidden">
        {showDiff ? (
          <DiffEditor
            height="100%"
            language="python"
            theme="vs-dark"
            original={originalCode}
            modified={code}
            options={{
              readOnly: true,
              renderSideBySide: true,
              minimap: { enabled: true },
              fontSize: 13,
              lineNumbers: 'on',
              wordWrap: 'off',
              scrollBeyondLastLine: false,
              tabSize: 4,
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
              renderLineHighlight: 'none',
              renderOverviewRuler: false
            }}
          />
        ) : (
          <Editor
            height="100%"
            language="python"
            theme="vs-dark"
            value={editedCode ?? code}
            onChange={(val) => {
              if (isEditable) setEditedCode(val ?? '')
            }}
            options={{
              readOnly: !isEditable,
              minimap: { enabled: true },
              fontSize: 13,
              lineNumbers: 'on',
              wordWrap: 'off',
              scrollBeyondLastLine: false,
              tabSize: 4,
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
              renderLineHighlight: isEditable ? 'line' : 'none'
            }}
          />
        )}
      </div>
    </div>
  )
}
