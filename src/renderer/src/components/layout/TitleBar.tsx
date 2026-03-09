import React, { useState } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { Button } from '../ui/button'
import {
  FilePlus,
  FolderOpen,
  Save,
  Settings,
  Download,
  Box
} from 'lucide-react'
import { SettingsModal } from '../modals/SettingsModal'
import { ExportModal } from '../modals/ExportModal'
import { cn } from '../../lib/utils'

export function TitleBar(): JSX.Element {
  const { project, isDirty, newProject, setProject, setCurrentFilePath, currentFilePath } =
    useProjectStore()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [saving, setSaving] = useState(false)

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
    const loaded = await window.electronAPI.loadProject()
    if (loaded) {
      setProject(loaded)
      setCurrentFilePath(null) // path not returned by load, reset
    }
  }

  async function handleSave(): Promise<void> {
    setSaving(true)
    try {
      const result = await window.electronAPI.saveProject(project, currentFilePath ?? undefined)
      setCurrentFilePath(result.path)
      useProjectStore.getState().setDirty(false)
    } catch (e) {
      if ((e as Error).message !== 'Save cancelled') {
        alert(`Save failed: ${(e as Error).message}`)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="titlebar-drag flex h-9 items-center bg-slate-900 border-b border-slate-700/50 px-3 gap-2 select-none">
        {/* App icon + title */}
        <div className="titlebar-nodrag flex items-center gap-2 mr-4">
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
        </div>

        {/* Project name */}
        <div className="flex-1 text-center text-xs text-muted-foreground truncate">
          {project.name}
          {isDirty && ' (unsaved)'}
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
            onClick={() => setSettingsOpen(true)}
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} />
    </>
  )
}
