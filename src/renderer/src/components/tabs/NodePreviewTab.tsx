import React, { createContext, useContext, useMemo } from 'react'
import type { ComfyNodeDef, NodeInput, NodeOutput, ComfyType } from '../../types/node.types'
import { getTypeInfo, getTypeHex } from '../../lib/comfyTypes'
import { useSettingsStore } from '../../store/settingsStore'
import { applyOperations } from '../../lib/nodeOperations'
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
                <MockText multiline={w?.multiline} defaultVal={w?.default as string | undefined} placeholder={w?.placeholder} />
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
    <select
      className="flex-1 bg-slate-700/60 border border-slate-600 rounded px-2 py-0.5 text-xs text-slate-300 cursor-pointer select-text"
      defaultValue={options[0] ?? ''}
    >
      {options.length > 0 ? (
        options.map((o) => <option key={o} value={o}>{o}</option>)
      ) : (
        <option value="">Select…</option>
      )}
    </select>
  )
}

function MockText({ multiline, defaultVal, placeholder }: { multiline?: boolean; defaultVal?: string; placeholder?: string }): JSX.Element {
  const displayText = defaultVal ? String(defaultVal) : undefined

  if (multiline) {
    return (
      <div className="flex-1 bg-slate-700/60 border border-slate-600 rounded px-2 py-1 min-h-[3rem] max-h-20 overflow-hidden">
        <span className={`text-xs block whitespace-pre-wrap break-words leading-tight ${displayText ? 'text-slate-300' : 'text-slate-500 italic'}`}>
          {displayText ?? placeholder ?? ''}
        </span>
      </div>
    )
  }

  return (
    <div className="flex-1 bg-slate-700/60 border border-slate-600 rounded px-2 h-7 flex items-center">
      <span className={`text-xs truncate ${displayText ? 'text-slate-300' : 'text-slate-500 italic'}`}>
        {displayText ?? placeholder ?? ''}
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
  const { typeColorOverrides, pendingProposal } = useSettingsStore()

  const displayNode = useMemo(() => {
    if (pendingProposal?.nodeId !== node.id) return node
    const validOps = (pendingProposal.operations ?? []).filter((op: any) => !op._invalid)
    if (validOps.length === 0) return node
    const result = applyOperations(node, validOps)
    if ('error' in result) return node
    return { ...node, ...result.updates }
  }, [node, pendingProposal])

  const socketInputs = displayNode.inputs.filter((i) => !isWidget(i))
  const widgetInputs = displayNode.inputs.filter((i) => isWidget(i))

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
                {displayNode.displayName || displayNode.internalName}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {displayNode.isOutputNode && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-400 border border-amber-700/50 font-medium">
                  OUTPUT
                </span>
              )}
              {displayNode.isInputNode && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-900/60 text-green-400 border border-green-700/50 font-medium">
                  INPUT
                </span>
              )}
            </div>
          </div>

          {/* Node body */}
          <div style={{ background: '#1e1e30' }}>
            {/* Description */}
            {displayNode.description && (
              <div
                className="px-3 py-1.5 text-[10px] text-slate-500 italic"
                style={{ borderBottom: '1px solid #2a2a40' }}
              >
                {displayNode.description}
              </div>
            )}

            {/* Socket connections — left inputs, right outputs side by side */}
            {(socketInputs.length > 0 || displayNode.outputs.length > 0) && (
              <div>
                {/* Column headers */}
                <div className="flex px-3 pt-1.5 pb-0.5">
                  <div className="flex-1 text-[9px] uppercase tracking-widest text-slate-600 font-semibold">
                    {socketInputs.length > 0 ? 'Inputs' : ''}
                  </div>
                  {socketInputs.length > 0 && displayNode.outputs.length > 0 && <div style={{ width: 1 }} />}
                  <div className="flex-1 text-[9px] uppercase tracking-widest text-slate-600 font-semibold text-right">
                    {displayNode.outputs.length > 0 ? 'Outputs' : ''}
                  </div>
                </div>
                <div className="flex">
                  {/* Left: socket inputs */}
                  <div className="flex-1 pb-1 pr-2 pl-3">
                    {socketInputs.map((input) => (
                      <SocketInputRow key={input.id} input={input} />
                    ))}
                    {/* Pad to match output row count */}
                    {Array.from({ length: Math.max(0, displayNode.outputs.length - socketInputs.length) }).map((_, i) => (
                      <div key={`pad-${i}`} className="py-1 h-6" />
                    ))}
                  </div>

                  {/* Divider */}
                  {socketInputs.length > 0 && displayNode.outputs.length > 0 && (
                    <div style={{ width: 1, background: '#2d2d4a' }} />
                  )}

                  {/* Right: outputs */}
                  <div className="flex-1 pb-1 pl-2 pr-3">
                    {displayNode.outputs.map((output) => (
                      <OutputRow key={output.id} output={output} />
                    ))}
                    {/* Pad to match input row count */}
                    {Array.from({ length: Math.max(0, socketInputs.length - displayNode.outputs.length) }).map((_, i) => (
                      <div key={`pad-${i}`} className="py-1 h-6" />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Widget inputs */}
            {widgetInputs.length > 0 && (
              <div style={{ borderTop: (socketInputs.length > 0 || displayNode.outputs.length > 0) ? '1px solid #2a2a40' : undefined }}>
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
            {displayNode.inputs.length === 0 && displayNode.outputs.length === 0 && (
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
            <span className="text-slate-400">{displayNode.outputs.length}</span> output{displayNode.outputs.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Type legend for types in use */}
        <TypeLegend node={displayNode} />
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
