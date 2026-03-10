import React, { createContext, useContext } from 'react'
import type { ComfyNodeDef, NodeInput, NodeOutput, ComfyType } from '../../types/node.types'
import { getTypeInfo, getTypeHex } from '../../lib/comfyTypes'
import { useSettingsStore } from '../../store/settingsStore'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider
} from '../ui/tooltip'

interface NodePreviewTabProps {
  node: ComfyNodeDef
}

// Context to pass color overrides through the component tree
const ColorOverridesContext = createContext<Record<string, string>>({})

function useTypeColor(type: ComfyType): string {
  const overrides = useContext(ColorOverridesContext)
  return getTypeHex(type, overrides)
}

function isWidget(input: NodeInput): boolean {
  const widgetTypes: ComfyType[] = ['INT', 'FLOAT', 'STRING', 'BOOLEAN', 'COMBO']
  return widgetTypes.includes(input.type) && !input.forceInput
}

interface ConnectorDotProps {
  type: ComfyType
  side: 'left' | 'right'
}

function ConnectorDot({ type }: ConnectorDotProps): JSX.Element {
  const color = useTypeColor(type)
  return (
    <div
      className="h-3 w-3 rounded-sm border-2 shrink-0"
      style={{
        backgroundColor: color,
        borderColor: color,
        boxShadow: `0 0 4px ${color}60`
      }}
      title={`${type} connector`}
    />
  )
}

interface SocketRowProps {
  input: NodeInput
}

function SocketInputRow({ input }: SocketRowProps): JSX.Element {
  const info = getTypeInfo(input.type)
  const color = useTypeColor(input.type)

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 py-1 group cursor-default">
            {/* Dot offset to simulate edge connector */}
            <ConnectorDot type={input.type} side="left" />
            <span className="text-xs text-slate-300 font-medium truncate max-w-[120px]">
              {input.name}
            </span>
            {!input.required && (
              <span className="text-[10px] text-slate-600 shrink-0">(opt)</span>
            )}
            <span
              className="ml-auto text-[10px] font-mono shrink-0 opacity-60 group-hover:opacity-100 transition-opacity"
              style={{ color }}
            >
              {input.type}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-[200px] whitespace-pre-line">
          <p className="font-semibold" style={{ color }}>{info.label}</p>
          <p className="text-slate-400 mt-0.5">{info.description}</p>
          {input.tooltip && (
            <p className="text-slate-300 mt-1 border-t border-slate-700 pt-1">{input.tooltip}</p>
          )}
          {!input.required && <p className="text-slate-500 mt-1 text-[10px]">Optional</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

interface WidgetRowProps {
  input: NodeInput
}

function WidgetRow({ input }: WidgetRowProps): JSX.Element {
  const info = getTypeInfo(input.type)
  const w = input.widget

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 py-1 px-1 cursor-default group">
            <span className="text-xs text-slate-400 w-24 shrink-0 truncate">{input.name}</span>
            <div className="flex-1 flex items-center">
              {input.type === 'BOOLEAN' ? (
                <MockToggle value={w?.default as boolean | undefined} />
              ) : input.type === 'COMBO' ? (
                <MockCombo options={w?.comboOptions ?? []} />
              ) : input.type === 'STRING' ? (
                <MockText multiline={w?.multiline} defaultVal={w?.default as string | undefined} />
              ) : (
                <MockSlider
                  min={w?.min}
                  max={w?.max}
                  defaultVal={w?.default as number | undefined}
                  type={input.type}
                />
              )}
            </div>
            {!input.required && (
              <span className="text-[10px] text-slate-600 shrink-0">(opt)</span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[200px] whitespace-pre-line">
          <p className="font-semibold text-slate-200">{input.name}</p>
          <p className="text-slate-400 mt-0.5">{info.label} widget</p>
          {w?.min !== undefined && w?.max !== undefined && (
            <p className="text-slate-500 text-[10px]">Range: {w.min} – {w.max}</p>
          )}
          {input.tooltip && (
            <p className="text-slate-300 mt-1 border-t border-slate-700 pt-1">{input.tooltip}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function MockSlider({ min, max, defaultVal, type }: { min?: number; max?: number; defaultVal?: number; type: ComfyType }): JSX.Element {
  const displayVal = defaultVal ?? (type === 'INT' ? 0 : 0.0)
  const displayMin = min ?? 0
  const displayMax = max ?? (type === 'INT' ? 100 : 1)
  const pct = Math.max(0, Math.min(1, (displayVal - displayMin) / (displayMax - displayMin || 1)))

  return (
    <div className="flex-1 flex items-center gap-1.5">
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-sky-500 rounded-full"
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      <span className="text-xs text-slate-300 font-mono w-12 text-right">
        {type === 'FLOAT' ? displayVal.toFixed(2) : displayVal}
      </span>
    </div>
  )
}

function MockToggle({ value }: { value?: boolean }): JSX.Element {
  const on = value ?? false
  return (
    <div className={`h-4 w-8 rounded-full transition-colors flex items-center px-0.5 ${on ? 'bg-blue-500' : 'bg-slate-600'}`}>
      <div className={`h-3 w-3 rounded-full bg-white transition-transform ${on ? 'translate-x-4' : 'translate-x-0'}`} />
    </div>
  )
}

function MockCombo({ options }: { options: string[] }): JSX.Element {
  return (
    <div className="flex-1 bg-slate-700/60 border border-slate-600 rounded px-2 py-0.5 flex items-center justify-between">
      <span className="text-xs text-slate-300 truncate">{options[0] ?? 'Select…'}</span>
      <span className="text-slate-500 text-xs ml-1">▾</span>
    </div>
  )
}

function MockText({ multiline, defaultVal }: { multiline?: boolean; defaultVal?: string }): JSX.Element {
  return (
    <div className={`flex-1 bg-slate-700/60 border border-slate-600 rounded px-2 py-0.5 ${multiline ? 'h-8' : ''}`}>
      <span className="text-xs text-slate-400 truncate">
        {defaultVal ? String(defaultVal) : (multiline ? 'multiline text…' : 'text…')}
      </span>
    </div>
  )
}

interface OutputRowProps {
  output: NodeOutput
}

function OutputRow({ output }: OutputRowProps): JSX.Element {
  const info = getTypeInfo(output.type)
  const color = useTypeColor(output.type)

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 py-1 group cursor-default justify-end">
            <span
              className="text-[10px] font-mono shrink-0 opacity-60 group-hover:opacity-100 transition-opacity"
              style={{ color }}
            >
              {output.type}
            </span>
            <span className="text-xs text-slate-300 font-medium truncate max-w-[120px] text-right">
              {output.name}
            </span>
            <ConnectorDot type={output.type} side="right" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-[200px] whitespace-pre-line">
          <p className="font-semibold" style={{ color }}>{info.label}</p>
          <p className="text-slate-400 mt-0.5">{info.description}</p>
          {output.tooltip && (
            <p className="text-slate-300 mt-1 border-t border-slate-700 pt-1">{output.tooltip}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function NodePreviewTab({ node }: NodePreviewTabProps): JSX.Element {
  const { typeColorOverrides } = useSettingsStore()
  const socketInputs = node.inputs.filter((i) => !isWidget(i))
  const widgetInputs = node.inputs.filter((i) => isWidget(i))

  return (
    <ColorOverridesContext.Provider value={typeColorOverrides}>
      <div className="h-full overflow-auto bg-slate-950 flex flex-col items-center justify-start pt-12 pb-12 px-4">
        <div className="text-xs text-slate-600 mb-6 text-center">
          Visual preview — hover inputs/outputs for details
        </div>

        {/* Node card */}
        <div
          className="rounded-lg overflow-hidden shadow-2xl"
          style={{
            minWidth: 280,
            maxWidth: 480,
            width: '100%',
            background: '#1a1a2e',
            border: '1px solid #2d2d4a'
          }}
        >
          {/* Title bar */}
          <div
            className="px-3 py-2 flex items-center gap-2"
            style={{ background: '#252540', borderBottom: '1px solid #2d2d4a' }}
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-100 truncate">
                {node.displayName || node.internalName}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                {node.category}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {node.isOutputNode && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-400 border border-amber-700/50 font-medium">
                  OUTPUT
                </span>
              )}
              {node.isInputNode && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-900/60 text-green-400 border border-green-700/50 font-medium">
                  INPUT
                </span>
              )}
            </div>
          </div>

          {/* Node body */}
          <div style={{ background: '#1e1e30' }}>
            {/* Description */}
            {node.description && (
              <div
                className="px-3 py-1.5 text-[10px] text-slate-500 italic"
                style={{ borderBottom: '1px solid #2a2a40' }}
              >
                {node.description}
              </div>
            )}

            {/* Socket connections — left inputs, right outputs side by side */}
            {(socketInputs.length > 0 || node.outputs.length > 0) && (
              <div className="flex">
                {/* Left: socket inputs */}
                <div className="flex-1 py-1 pr-2 pl-3">
                  {socketInputs.map((input) => (
                    <SocketInputRow key={input.id} input={input} />
                  ))}
                  {/* Pad to match output row count */}
                  {Array.from({ length: Math.max(0, node.outputs.length - socketInputs.length) }).map((_, i) => (
                    <div key={`pad-${i}`} className="py-1 h-6" />
                  ))}
                </div>

                {/* Divider */}
                {socketInputs.length > 0 && node.outputs.length > 0 && (
                  <div style={{ width: 1, background: '#2d2d4a' }} />
                )}

                {/* Right: outputs */}
                <div className="flex-1 py-1 pl-2 pr-3">
                  {node.outputs.map((output) => (
                    <OutputRow key={output.id} output={output} />
                  ))}
                  {/* Pad to match input row count */}
                  {Array.from({ length: Math.max(0, socketInputs.length - node.outputs.length) }).map((_, i) => (
                    <div key={`pad-${i}`} className="py-1 h-6" />
                  ))}
                </div>
              </div>
            )}

            {/* Widget inputs */}
            {widgetInputs.length > 0 && (
              <div style={{ borderTop: (socketInputs.length > 0 || node.outputs.length > 0) ? '1px solid #2a2a40' : undefined }}>
                {widgetInputs.map((input) => (
                  <div
                    key={input.id}
                    style={{ borderBottom: '1px solid #252538' }}
                  >
                    <WidgetRow input={input} />
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {node.inputs.length === 0 && node.outputs.length === 0 && (
              <div className="py-6 text-center text-xs text-slate-600">
                No inputs or outputs defined
              </div>
            )}
          </div>
        </div>

        {/* Stats below the node */}
        <div className="mt-8 flex gap-6 text-xs text-slate-600">
          <span>
            <span className="text-slate-400">{socketInputs.length}</span> socket input{socketInputs.length !== 1 ? 's' : ''}
          </span>
          <span>
            <span className="text-slate-400">{widgetInputs.length}</span> widget{widgetInputs.length !== 1 ? 's' : ''}
          </span>
          <span>
            <span className="text-slate-400">{node.outputs.length}</span> output{node.outputs.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Type legend for types in use */}
        <TypeLegend node={node} />
      </div>
    </ColorOverridesContext.Provider>
  )
}

function TypeLegend({ node }: { node: ComfyNodeDef }): JSX.Element | null {
  const overrides = useContext(ColorOverridesContext)
  const types = new Set<ComfyType>()
  node.inputs.forEach((i) => types.add(i.type))
  node.outputs.forEach((o) => types.add(o.type))
  if (types.size === 0) return null

  return (
    <div className="mt-6 flex flex-wrap gap-2 justify-center max-w-[400px]">
      {[...types].map((type) => {
        const info = getTypeInfo(type)
        const color = getTypeHex(type, overrides)
        return (
          <div
            key={type}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px]"
            style={{ background: '#1e1e30', border: `1px solid ${color}40`, color: color }}
          >
            <div
              className="h-2 w-2 rounded-sm"
              style={{ backgroundColor: color }}
            />
            {info.label}
          </div>
        )
      })}
    </div>
  )
}
