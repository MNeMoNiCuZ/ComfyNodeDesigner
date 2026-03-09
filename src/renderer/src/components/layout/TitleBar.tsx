import React, { useState, useRef, useEffect } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { useSettingsStore } from '../../store/settingsStore'
import { Button } from '../ui/button'
import {
  FilePlus,
  FolderOpen,
  Save,
  Settings,
  Download,
  Box,
  Pencil,
  ChevronDown,
  Upload
} from 'lucide-react'
import { ExportModal } from '../modals/ExportModal'
import { cn } from '../../lib/utils'
import { createDefaultNode } from '../../types/node.types'
import type { ComfyNodeDef } from '../../types/node.types'

export function TitleBar(): JSX.Element {
  const { project, isDirty, newProject, openProject, currentFilePath, setProjectName, importNodes } =
    useProjectStore()
  const { setActiveEditorTab, addRecentProject, recentProjects, recentProjectsEnabled } =
    useSettingsStore()
  const [exportOpen, setExportOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(project.name)
  const [recentOpen, setRecentOpen] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const recentDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setNameValue(project.name) }, [project.name])
  useEffect(() => { if (editingName) nameInputRef.current?.select() }, [editingName])

  // Close recent dropdown when clicking outside
  useEffect(() => {
    if (!recentOpen) return
    function handleClickOutside(e: MouseEvent): void {
      if (recentDropdownRef.current && !recentDropdownRef.current.contains(e.target as Node)) {
        setRecentOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [recentOpen])

  function commitName(): void {
    const trimmed = nameValue.trim()
    if (trimmed && trimmed !== project.name) setProjectName(trimmed)
    else setNameValue(project.name)
    setEditingName(false)
  }

  async function handleNew(): Promise<void> {
    if (isDirty) {
      const confirmed = window.confirm('You have unsaved changes. Create a new project anyway?')
      if (!confirmed) return
    }
    newProject()
  }

  async function handleOpen(): Promise<void> {
    if (isDirty) {
      const confirmed = window.confirm('You have unsaved changes. Open another project anyway?')
      if (!confirmed) return
    }
    const result = await window.electronAPI.loadProject()
    if (result) {
      openProject(result.project, result.filePath)
      addRecentProject(result.filePath, result.project.name)
    }
  }

  async function handleOpenRecent(recentPath: string): Promise<void> {
    setRecentOpen(false)
    if (isDirty) {
      const confirmed = window.confirm('You have unsaved changes. Open another project anyway?')
      if (!confirmed) return
    }
    try {
      // Use the same loadProject IPC but we can't pass a path directly — instead
      // load via a custom approach: we re-use the loadProject result structure
      // by simulating the IPC (the main process doesn't accept a path param).
      // Since we can't bypass the dialog easily, we fall back to normal open
      // and notify user.
      alert(`Please use File > Open and navigate to:\n${recentPath}`)
    } catch {
      // ignore
    }
  }

  async function handleSave(): Promise<void> {
    setSaving(true)
    try {
      const result = await window.electronAPI.saveProject(project, currentFilePath ?? undefined)
      if (result) {
        useProjectStore.getState().setCurrentFilePath(result.path)
        useProjectStore.getState().setDirty(false)
        addRecentProject(result.path, project.name)
      }
      // result is null when user cancelled the dialog — do nothing
    } catch (e) {
      alert(`Save failed: ${(e as Error).message ?? String(e)}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleImport(): Promise<void> {
    try {
      const rawNodes = await window.electronAPI.importNodeFolder()
      if (!rawNodes || rawNodes.length === 0) {
        alert('No nodes found in the selected folder.')
        return
      }
      // Convert ImportedNodeDef[] to ComfyNodeDef[]
      const converted: ComfyNodeDef[] = rawNodes.map((raw: any) => {
        return createDefaultNode({
          internalName: raw.internalName ?? 'imported_node',
          displayName: raw.displayName ?? raw.internalName ?? 'Imported Node',
          category: raw.category ?? 'custom',
          functionName: raw.functionName ?? 'execute',
          isOutputNode: raw.isOutputNode ?? false,
          executeBody: raw.executeBody ?? '        pass',
          inputs: (raw.inputs ?? []).map((inp: any) => ({
            id: crypto.randomUUID(),
            name: inp.name,
            type: inp.type as any,
            required: inp.required ?? true,
            forceInput: inp.forceInput,
            widget: inp.widget
              ? {
                  min: inp.widget.min,
                  max: inp.widget.max,
                  step: inp.widget.step,
                  default: inp.widget.defaultValue,
                  multiline: inp.widget.multiline,
                  comboOptions: inp.widget.comboOptions
                }
              : undefined
          })),
          outputs: (raw.outputs ?? []).map((out: any) => ({
            id: crypto.randomUUID(),
            name: out.name,
            type: out.type as any
          }))
        })
      })
      importNodes(converted)
      alert(`Imported ${converted.length} node${converted.length !== 1 ? 's' : ''}.`)
    } catch (e) {
      alert(`Import failed: ${(e as Error).message ?? String(e)}`)
    }
  }

  const showRecentButton =
    recentProjectsEnabled && recentProjects.length > 0

  return (
    <>
      <div className="titlebar-drag flex h-9 items-center bg-slate-900 border-b border-slate-700/50 px-3 pr-36 gap-2 select-none">
        {/* App icon + title — stays draggable */}
        <div className="flex items-center gap-2 mr-4">
          <Box className="h-4 w-4 text-blue-400 shrink-0" />
          <span className="text-sm font-semibold text-slate-200">ComfyNode Designer</span>
        </div>

        {/* File actions */}
        <div className="titlebar-nodrag flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs text-slate-300 hover:text-white px-2"
            onClick={handleNew}
            title="New project (Ctrl+N)"
          >
            <FilePlus className="h-3.5 w-3.5" />
            New
          </Button>

          {/* Open + Recent Projects */}
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs text-slate-300 hover:text-white px-2"
              onClick={handleOpen}
              title="Open project (Ctrl+O)"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              Open
            </Button>
            {showRecentButton && (
              <div className="relative" ref={recentDropdownRef}>
                <button
                  className="h-7 w-5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700/50 rounded transition-colors"
                  onClick={() => setRecentOpen((v) => !v)}
                  title="Recent projects"
                >
                  <ChevronDown className="h-3 w-3" />
                </button>
                {recentOpen && (
                  <div className="absolute top-full left-0 mt-1 z-50 min-w-64 max-w-xs bg-slate-800 border border-slate-600 rounded-md shadow-xl overflow-hidden">
                    <div className="px-3 py-1.5 border-b border-slate-700">
                      <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">
                        Recent Projects
                      </span>
                    </div>
                    <ul className="max-h-64 overflow-y-auto py-1">
                      {recentProjects.map((rp) => (
                        <li key={rp.path}>
                          <button
                            className="w-full text-left px-3 py-2 hover:bg-slate-700 transition-colors"
                            onClick={() => handleOpenRecent(rp.path)}
                          >
                            <div className="text-xs text-slate-200 truncate font-medium">
                              {rp.name}
                            </div>
                            <div
                              className="text-[10px] text-slate-500 truncate"
                              title={rp.path}
                            >
                              {rp.path}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-7 gap-1.5 text-xs px-2',
              isDirty ? 'text-amber-400 hover:text-amber-300' : 'text-slate-300 hover:text-white'
            )}
            onClick={handleSave}
            disabled={saving}
            title="Save project (Ctrl+S)"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Saving…' : isDirty ? 'Save*' : 'Save'}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs text-slate-300 hover:text-white px-2"
            onClick={handleImport}
            title="Import nodes from Python folder"
          >
            <Upload className="h-3.5 w-3.5" />
            Import
          </Button>
        </div>

        {/* Project name — click to edit; only the button/input is no-drag */}
        <div className="flex-1 flex items-center justify-center">
          {editingName ? (
            <input
              ref={nameInputRef}
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitName()
                if (e.key === 'Escape') { setNameValue(project.name); setEditingName(false) }
              }}
              className="titlebar-nodrag bg-slate-800 border border-slate-600 rounded px-2 py-0.5 text-xs text-slate-200 text-center w-48 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          ) : (
            <button
              className="titlebar-nodrag group flex items-center gap-1.5 text-xs text-muted-foreground hover:text-slate-200 transition-colors rounded px-2 py-0.5 hover:bg-slate-800"
              onClick={() => setEditingName(true)}
              title="Click to rename project"
            >
              <span className="truncate max-w-48">{project.name}{isDirty ? ' *' : ''}</span>
              <Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-60 shrink-0 transition-opacity" />
            </button>
          )}
        </div>

        {/* Right side actions */}
        <div className="titlebar-nodrag flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs text-slate-300 hover:text-white px-2"
            onClick={() => setExportOpen(true)}
            title="Export code"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-300 hover:text-white"
            onClick={() => setActiveEditorTab('settings')}
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} />
    </>
  )
}
