import React, { useEffect, useCallback } from 'react'
import { TooltipProvider } from './components/ui/tooltip'
import { TitleBar } from './components/layout/TitleBar'
import { NodePanel } from './components/layout/NodePanel'
import { NodeEditor } from './components/layout/NodeEditor'
import { useProjectStore } from './store/projectStore'
import { useSettingsStore } from './store/settingsStore'

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }

  static getDerivedStateFromError(error: Error): { hasError: boolean; error: string } {
    return { hasError: true, error: error.message }
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center bg-slate-950 p-8">
          <div className="max-w-md text-center space-y-4">
            <h1 className="text-xl font-bold text-red-400">Something went wrong</h1>
            <p className="text-sm text-slate-400">{this.state.error}</p>
            <button
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm"
              onClick={() => this.setState({ hasError: false, error: '' })}
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App(): JSX.Element {
  const { loadFromMain } = useSettingsStore()

  // Load settings on startup
  useEffect(() => {
    loadFromMain()
  }, [])

  // Keyboard shortcuts — read state directly from store to avoid stale closures
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const isMac = navigator.platform.includes('Mac')
      const mod = isMac ? e.metaKey : e.ctrlKey

      if (mod && e.key === 's') {
        e.preventDefault()
        const { project, currentFilePath } = useProjectStore.getState()
        window.electronAPI
          .saveProject(project, currentFilePath ?? undefined)
          .then((result) => {
            if (result) {
              useProjectStore.getState().setCurrentFilePath(result.path)
              useProjectStore.getState().setDirty(false)
              useSettingsStore.getState().addRecentProject(result.path, project.name)
            }
          })
          .catch(() => {/* cancelled */})
      } else if (mod && e.key === 'n' && !e.shiftKey) {
        e.preventDefault()
        if (useProjectStore.getState().isDirty) {
          window.electronAPI.showConfirmDialog('You have unsaved changes.', 'Create a new project anyway?').then((ok) => {
            if (ok) useProjectStore.getState().newProject()
          })
        } else {
          useProjectStore.getState().newProject()
        }
      } else if (mod && e.key === 'o') {
        e.preventDefault()
        const proceed = (): void => {
          window.electronAPI.loadProject().then((loaded) => {
            if (loaded) {
              useProjectStore.getState().openProject(loaded.project, loaded.filePath)
              useSettingsStore.getState().addRecentProject(loaded.filePath, loaded.project.name)
            }
          })
        }
        if (useProjectStore.getState().isDirty) {
          window.electronAPI.showConfirmDialog('You have unsaved changes.', 'Open another project anyway?').then((ok) => {
            if (ok) proceed()
          })
        } else {
          proceed()
        }
      }
    },
    []
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Window close — handled via IPC from main process for reliable behavior
  useEffect(() => {
    window.electronAPI.onCheckClose(() => {
      const dirty = useProjectStore.getState().isDirty
      if (!dirty) {
        window.electronAPI.forceClose()
      } else {
        window.electronAPI.showConfirmDialog('You have unsaved changes.', 'Close anyway?').then((ok) => {
          if (ok) window.electronAPI.forceClose()
        })
      }
    })
  }, [])

  return (
    <ErrorBoundary>
      <TooltipProvider delayDuration={400}>
        <div className="flex h-screen flex-col overflow-hidden bg-slate-950 text-slate-100 select-none">
          <TitleBar />
          <div className="flex flex-1 overflow-hidden">
            <NodePanel />
            <NodeEditor />
          </div>
        </div>
      </TooltipProvider>
    </ErrorBoundary>
  )
}
