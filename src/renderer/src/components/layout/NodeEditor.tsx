import React from 'react'
import { useProjectStore, useSelectedNode } from '../../store/projectStore'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs'
import { IdentityTab } from '../tabs/IdentityTab'
import { InputsTab } from '../tabs/InputsTab'
import { OutputsTab } from '../tabs/OutputsTab'
import { AdvancedTab } from '../tabs/AdvancedTab'
import { LLMTab } from '../tabs/LLMTab'
import { PreviewTab } from '../tabs/PreviewTab'
import { Box, Plus } from 'lucide-react'
import { Button } from '../ui/button'

export function NodeEditor(): JSX.Element {
  const { addNode } = useProjectStore()
  const selectedNode = useSelectedNode()

  if (!selectedNode) {
    return (
      <div className="flex flex-1 items-center justify-center bg-slate-950">
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
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-slate-950">
      <Tabs defaultValue="identity" className="flex flex-col flex-1 overflow-hidden">
        {/* Tab bar */}
        <div className="border-b border-slate-700/50 px-4 pt-3 pb-0 bg-slate-900/50">
          <TabsList className="rounded-none bg-transparent p-0 h-auto gap-1">
            {[
              { value: 'identity', label: 'Identity' },
              { value: 'inputs', label: 'Inputs' },
              { value: 'outputs', label: 'Outputs' },
              { value: 'advanced', label: 'Advanced' },
              { value: 'llm', label: 'LLM Logic' },
              { value: 'preview', label: 'Preview' }
            ].map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="rounded-none rounded-t-md border-b-2 border-transparent px-4 py-2 text-sm data-[state=active]:border-blue-500 data-[state=active]:bg-transparent data-[state=active]:text-blue-400 data-[state=active]:shadow-none text-slate-400 hover:text-slate-200"
              >
                {tab.label}
              </TabsTrigger>
            ))}
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
          <TabsContent value="llm" className="h-full m-0 overflow-hidden">
            <LLMTab node={selectedNode} />
          </TabsContent>
          <TabsContent value="preview" className="h-full m-0 overflow-hidden">
            <PreviewTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
