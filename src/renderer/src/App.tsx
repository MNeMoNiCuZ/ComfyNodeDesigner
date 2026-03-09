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
  const { project, isDirty, addNode, setProject, setCurrentFilePath, currentFilePath } =
    useProjectStore()
  const { loadFromMain } = useSettingsStore()

  // Load settings on startup
  useEffect(() => {
    loadFromMain()
  }, [])

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const isMac = navigator.platform.includes('Mac')
      const mod = isMac ? e.metaKey : e.ctrlKey

      if (mod && e.key === 's') {
        e.preventDefault()
        document.querySelector<HTMLButtonElement>('[data-save-btn]')?.click()
        // Fallback: trigger save via store
        window.electronAPI
          .saveProject(project, currentFilePath ?? undefined)
          .then((result: { path: string }) => {
            setCurrentFilePath(result.path)
            useProjectStore.getState().setDirty(false)
          })
          .catch(() => {/* cancelled */})
      } else if (mod && e.key === 'n' && !e.shiftKey) {
        e.preventDefault()
        if (isDirty && !window.confirm('Unsaved changes. Create new project?')) return
        useProjectStore.getState().newProject()
      } else if (mod && e.key === 'o') {
        e.preventDefault()
        window.electronAPI.loadProject().then((loaded: any) => {
          if (loaded) {
            setProject(loaded)
            setCurrentFilePath(null)
          }
        })
      }
    },
    [project, isDirty, currentFilePath]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Warn on close if dirty
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent): string | undefined => {
      if (isDirty) {
        e.preventDefault()
        return 'You have unsaved changes. Are you sure you want to quit?'
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

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
