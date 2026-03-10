import React from 'react'
import { useProjectStore, useSelectedNode } from '../../store/projectStore'
import { useSettingsStore } from '../../store/settingsStore'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs'
import { IdentityTab } from '../tabs/IdentityTab'
import { InputsTab } from '../tabs/InputsTab'
import { OutputsTab } from '../tabs/OutputsTab'
import { AdvancedTab } from '../tabs/AdvancedTab'
import { LLMTab } from '../tabs/LLMTab'
import { PreviewTab } from '../tabs/PreviewTab'
import { NodePreviewTab } from '../tabs/NodePreviewTab'
import { SettingsTab } from '../tabs/SettingsTab'
import { PackTab } from '../tabs/PackTab'
import { Box, Plus, Settings } from 'lucide-react'
import { Button } from '../ui/button'

const NODE_TABS = [
  { value: 'identity', label: 'Node Settings' },
  { value: 'inputs', label: 'Inputs' },
  { value: 'outputs', label: 'Outputs' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'llm', label: 'AI Assistant' },
  { value: 'preview', label: 'Preview' },
  { value: 'code', label: 'Code' }
]

export function NodeEditor(): JSX.Element {
  const { addNode, packSelected } = useProjectStore()
  const selectedNode = useSelectedNode()
  const { activeEditorTab, setActiveEditorTab, llmGenerating } = useSettingsStore()

  // When pack is selected, show PackTab (with Settings accessible)
  if (packSelected && !selectedNode) {
    const isSettings = activeEditorTab === 'settings'
    return (
      <div className="flex flex-1 flex-col overflow-hidden bg-slate-950">
        <div className="border-b border-slate-700/50 px-4 pt-3 pb-0 bg-slate-900/50">
          <div className="flex items-center">
            <button
              className={`flex items-center gap-1.5 rounded-t-md border-b-2 px-4 py-2 text-sm font-medium ${!isSettings ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
              onClick={() => setActiveEditorTab('pack')}
            >
              Pack
            </button>
            <div className="flex-1" />
            <button
              className={`flex items-center gap-1.5 rounded-t-md border-b-2 px-4 py-2 text-sm ${isSettings ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
              onClick={() => setActiveEditorTab('settings')}
            >
              <Settings className="h-3.5 w-3.5" />
              Settings
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          {isSettings ? <SettingsTab /> : <PackTab />}
        </div>
      </div>
    )
  }

  // When no node is selected, only allow Settings tab
  if (!selectedNode) {
    if (activeEditorTab !== 'settings') {
      return (
        <div className="flex flex-1 flex-col overflow-hidden bg-slate-950">
          {/* Tab bar with just Settings */}
          <div className="border-b border-slate-700/50 px-4 pt-3 pb-0 bg-slate-900/50">
            <div className="flex items-center">
              <div className="flex-1" />
              <button
                className="flex items-center gap-1.5 rounded-t-md border-b-2 border-transparent px-4 py-2 text-sm text-slate-400 hover:text-slate-200"
                onClick={() => setActiveEditorTab('settings')}
              >
                <Settings className="h-3.5 w-3.5" />
                Settings
              </button>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center">
            <div className="text-center space-y-4 max-w-sm">
              <Box className="mx-auto h-12 w-12 text-slate-700" />
              <div>
                <h3 className="text-lg font-semibold text-slate-400">No node selected</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Select a node from the panel on the left, or create a new one to start designing.
                </p>
              </div>
              <Button variant="outline" className="gap-2" onClick={() => addNode()}>
                <Plus className="h-4 w-4" />
                Create your first node
              </Button>
            </div>
          </div>
        </div>
      )
    }

    // Show settings tab standalone
    return (
      <div className="flex flex-1 flex-col overflow-hidden bg-slate-950">
        <div className="border-b border-slate-700/50 px-4 pt-3 pb-0 bg-slate-900/50">
          <div className="flex items-center">
            <div className="flex-1" />
            <button
              className="flex items-center gap-1.5 rounded-t-md border-b-2 border-blue-500 px-4 py-2 text-sm text-blue-400"
              onClick={() => setActiveEditorTab('settings')}
            >
              <Settings className="h-3.5 w-3.5" />
              Settings
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <SettingsTab />
        </div>
      </div>
    )
  }

  // Ensure tab is valid when node selected — 'settings' is always valid
  const validNodeTabValues = NODE_TABS.map((t) => t.value)
  const effectiveTab =
    activeEditorTab === 'settings' || validNodeTabValues.includes(activeEditorTab)
      ? activeEditorTab
      : 'identity'

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-slate-950">
      <Tabs value={effectiveTab} onValueChange={setActiveEditorTab} className="flex flex-col flex-1 overflow-hidden">
        {/* Tab bar */}
        <div className="border-b border-slate-700/50 px-4 pt-3 pb-0 bg-slate-900/50">
          <TabsList className="rounded-none bg-transparent p-0 h-auto gap-1 w-full flex items-center">
            {NODE_TABS.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="rounded-none rounded-t-md border-b-2 border-transparent px-4 py-2 text-sm data-[state=active]:border-blue-500 data-[state=active]:bg-transparent data-[state=active]:text-blue-400 data-[state=active]:shadow-none text-slate-400 hover:text-slate-200"
              >
                {tab.value === 'llm' && llmGenerating ? (
                  <span className="flex items-center gap-1.5">
                    AI Assistant
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                  </span>
                ) : (
                  tab.label
                )}
              </TabsTrigger>
            ))}
            {/* Spacer pushes Settings to the right */}
            <div className="flex-1" />
            {/* Settings tab — inside TabsList so Radix focus management works */}
            <TabsTrigger
              value="settings"
              className="rounded-none rounded-t-md border-b-2 border-transparent px-4 py-2 text-sm data-[state=active]:border-blue-500 data-[state=active]:bg-transparent data-[state=active]:text-blue-400 data-[state=active]:shadow-none text-slate-400 hover:text-slate-200 flex items-center gap-1.5"
            >
              <Settings className="h-3.5 w-3.5" />
              Settings
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-hidden">
          <TabsContent value="identity" className="h-full m-0 overflow-y-auto">
            <IdentityTab node={selectedNode} />
          </TabsContent>
          <TabsContent value="inputs" className="h-full m-0 overflow-hidden">
            <InputsTab node={selectedNode} />
          </TabsContent>
          <TabsContent value="outputs" className="h-full m-0 overflow-hidden">
            <OutputsTab node={selectedNode} />
          </TabsContent>
          <TabsContent value="advanced" className="h-full m-0 overflow-y-auto">
            <AdvancedTab node={selectedNode} />
          </TabsContent>
          {/* forceMount LLM tab so chat state persists across tab switches */}
          <TabsContent value="llm" className="h-full m-0 overflow-hidden data-[state=inactive]:hidden" forceMount>
            <LLMTab node={selectedNode} />
          </TabsContent>
          <TabsContent value="preview" className="h-full m-0 overflow-hidden">
            <NodePreviewTab node={selectedNode} />
          </TabsContent>
          <TabsContent value="code" className="h-full m-0 overflow-hidden">
            <PreviewTab />
          </TabsContent>
          <TabsContent value="settings" className="h-full m-0 overflow-hidden">
            <SettingsTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
