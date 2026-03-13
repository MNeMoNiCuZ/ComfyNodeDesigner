import React, { useState, useEffect, useMemo } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { useSettingsStore } from '../../store/settingsStore'
import { generateAllFiles } from '../../../../main/generators/codeGenerator'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Button } from '../ui/button'
import { FieldLabel } from '../shared/TooltipWrapper'
import { Package, Info, Settings, Code2, FolderOpen, Download, Loader2 } from 'lucide-react'
import { ExportToast } from '../shared/ExportToast'
import Editor from '@monaco-editor/react'

export function PackTab(): JSX.Element {
  const { project, setPackName, setProjectName } = useProjectStore()
  const { exportPath, setExportPath } = useSettingsStore()
  const [exporting, setExporting] = useState(false)
  const [exportedPath, setExportedPath] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  const [localPackName, setLocalPackName] = useState(project.packName ?? 'ComfyUI_')
  const [localProjectName, setLocalProjectName] = useState(project.name)
  const [packSubTab, setPackSubTab] = useState<'settings' | 'code'>('settings')

  // Sync if project changes externally (e.g. on open)
  useEffect(() => {
    setLocalPackName(project.packName ?? 'ComfyUI_')
    setLocalProjectName(project.name)
  }, [project.packName, project.name])

  // Debounced save
  useEffect(() => {
    const t = setTimeout(() => {
      if (localPackName !== project.packName) setPackName(localPackName)
    }, 300)
    return () => clearTimeout(t)
  }, [localPackName])

  useEffect(() => {
    const t = setTimeout(() => {
      if (localProjectName !== project.name) setProjectName(localProjectName)
    }, 300)
  }, [localProjectName])

  const sanitized = localPackName.replace(/[^a-zA-Z0-9_-]/g, '_') || 'ComfyUI_Pack'
  const hasPrefix = localPackName.startsWith('ComfyUI_')

  async function handleBrowseExportPath(): Promise<void> {
    try {
      const selected = await window.electronAPI.selectExportFolder()
      if (selected) setExportPath(selected)
    } catch {
      // ignore
    }
  }

  async function handleExportNow(): Promise<void> {
    if (!exportPath || project.nodes.length === 0) return
    setExporting(true)
    setExportError(null)
    try {
      const resultPath = await window.electronAPI.exportToPath(project.nodes, localPackName || project.name, exportPath)
      setExportedPath(resultPath)
    } catch (e) {
      setExportError((e as Error).message ?? 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  const files = useMemo(
    () => generateAllFiles(project.nodes, localPackName || project.name),
    [project.nodes, localPackName, project.name]
  )

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Sub-tab bar */}
      <div className="flex items-center gap-1 border-b border-slate-700/50 bg-slate-900/20 px-4 py-1.5">
        <button
          className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
            packSubTab === 'settings'
              ? 'bg-blue-600/80 text-white'
              : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-700/60'
          }`}
          onClick={() => setPackSubTab('settings')}
        >
          <Settings className="h-3 w-3" />
          Settings
        </button>
        <button
          className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
            packSubTab === 'code'
              ? 'bg-blue-600/80 text-white'
              : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-700/60'
          }`}
          onClick={() => setPackSubTab('code')}
        >
          <Code2 className="h-3 w-3" />
          Code
        </button>
      </div>

      {packSubTab === 'code' ? (
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="px-4 py-2 border-b border-slate-700/50 bg-slate-900/30">
            <span className="text-xs text-slate-500 font-mono">{sanitized}/__init__.py</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <Editor
              height="100%"
              language="python"
              theme="vs-dark"
              value={files.initPyIndividual}
              options={{
                readOnly: true,
                minimap: { enabled: false },
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
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto p-6 space-y-6">
            <div className="flex items-center gap-3">
              <Package className="h-7 w-7 text-blue-400 shrink-0" />
              <div>
                <h2 className="text-lg font-semibold text-slate-200">Node Pack</h2>
                <p className="text-xs text-muted-foreground">
                  All nodes in this project are exported together as a single ComfyUI custom node pack.
                </p>
              </div>
            </div>

            {/* Project display name — pretty first */}
            <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-4 space-y-3">
              <div className="space-y-1.5">
                <FieldLabel
                  label="Project Display Name"
                  tooltip="Human-readable name shown in the title bar and README. Does not affect export file or folder names — that's the Pack Name below."
                />
                <Input
                  value={localProjectName}
                  onChange={(e) => setLocalProjectName(e.target.value)}
                  placeholder="My Node Pack"
                />
                <p className="text-xs text-muted-foreground">
                  Shown in the title bar and README. Use a descriptive, human-friendly name.
                </p>
              </div>
            </div>

            {/* Pack Name — technical */}
            <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-4 space-y-3">
              <div className="space-y-1.5">
                <FieldLabel
                  label="Pack Name"
                  tooltip="Used as the folder name when exporting as a package, and as the module name in __init__.py. Must be a valid folder name. Use ComfyUI_ prefix so it's easy to find in the custom_nodes folder."
                  required
                />
                <Input
                  value={localPackName}
                  onChange={(e) => setLocalPackName(e.target.value)}
                  placeholder="ComfyUI_My_Pack"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Export folder: <code className="bg-slate-800 px-1 rounded text-slate-300">{sanitized}/</code>
                </p>
                {!hasPrefix && (
                  <div className="flex items-start gap-2 rounded-md bg-amber-950/40 border border-amber-800/40 p-2.5 text-xs text-amber-300">
                    <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>
                      Recommended: prefix with <code className="font-mono bg-amber-950/60 px-1 rounded">ComfyUI_</code> so it's easy to identify in the ComfyUI <code className="font-mono bg-amber-950/60 px-1 rounded">custom_nodes/</code> folder.
                    </span>
                  </div>
                )}
              </div>

              {/* Category folder note */}
              <div className="space-y-1.5 pt-1 border-t border-slate-700/50">
                <Label className="text-xs text-slate-400">Category grouping</Label>
                <p className="text-xs text-muted-foreground">
                  On each node's <strong className="text-slate-300">Node Settings</strong> tab, toggle <em>Include in pack folder</em> to place that node under{' '}
                  <code className="bg-slate-800 px-1 rounded text-slate-300">{sanitized}/category</code>{' '}
                  in the ComfyUI Add Node menu, keeping all your pack nodes together.
                </p>
              </div>
            </div>

            {/* Export preview */}
            <div className="rounded-lg border border-slate-700/50 bg-slate-800/20 p-4 space-y-2">
              <Label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Export Preview</Label>
              <div className="font-mono text-xs text-slate-400 space-y-0.5">
                <div>📁 <span className="text-slate-200">{sanitized}/</span></div>
                <div className="ml-4">📄 __init__.py</div>
                <div className="ml-4">📁 nodes/</div>
                {project.nodes.map((n) => (
                  <div key={n.id} className="ml-8">📄 {n.internalName}.py</div>
                ))}
                <div className="ml-4">📄 README.md</div>
              </div>
              <p className="text-xs text-slate-600">
                {project.nodes.length} node{project.nodes.length !== 1 ? 's' : ''} will be included.
              </p>
            </div>

            {/* Export Location */}
            <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-4 space-y-3">
              <div className="space-y-1.5">
                <FieldLabel
                  label="Export Location"
                  tooltip="Set this to your ComfyUI/custom_nodes/ folder. The pack folder will be created inside it automatically."
                />
                <div className="flex gap-2">
                  <Input
                    value={exportPath}
                    onChange={(e) => setExportPath(e.target.value)}
                    placeholder="C:/path/to/ComfyUI/custom_nodes/"
                    className="flex-1 font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5 border-slate-700"
                    onClick={handleBrowseExportPath}
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    Browse
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Set this to your <code className="bg-slate-800 px-1 rounded text-slate-300">ComfyUI/custom_nodes/</code> folder. The pack folder <code className="bg-slate-800 px-1 rounded text-slate-300">{sanitized}/</code> will be created inside it automatically.
                </p>
              </div>

              {exportError && (
                <p className="text-xs text-red-400">{exportError}</p>
              )}

              <Button
                className="gap-2 w-full"
                onClick={handleExportNow}
                disabled={!exportPath || project.nodes.length === 0 || exporting}
              >
                {exporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {exporting ? 'Exporting…' : 'Export Now'}
              </Button>
              {!exportPath && (
                <p className="text-xs text-slate-500 text-center">Set an export path above to enable export.</p>
              )}
              {exportPath && project.nodes.length === 0 && (
                <p className="text-xs text-slate-500 text-center">Add at least one node to export.</p>
              )}
            </div>
          </div>
        </div>
      )}
      <ExportToast exportedPath={exportedPath} onDismiss={() => setExportedPath(null)} />
    </div>
  )
}
