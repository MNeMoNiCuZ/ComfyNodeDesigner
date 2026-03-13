export type ComfyType =
  | 'IMAGE'
  | 'LATENT'
  | 'CONDITIONING'
  | 'MODEL'
  | 'VAE'
  | 'CLIP'
  | 'MASK'
  | 'CONTROL_NET'
  | 'STYLE_MODEL'
  | 'CLIP_VISION'
  | 'CLIP_VISION_OUTPUT'
  | 'UPSCALE_MODEL'
  | 'SAMPLER'
  | 'SIGMAS'
  | 'GUIDER'
  | 'NOISE'
  | 'GLIGEN'
  | 'AUDIO'
  | 'INT'
  | 'FLOAT'
  | 'STRING'
  | 'BOOLEAN'
  | 'SEED'
  | 'COMBO'
  | '*'

export type IsChangedMode = 'none' | 'always' | 'hash'

export interface InputWidget {
  min?: number
  max?: number
  step?: number
  round?: number
  multiline?: boolean
  comboOptions?: string[]
  default?: string | number | boolean
}

export interface NodeInput {
  id: string
  name: string
  type: ComfyType
  required: boolean
  tooltip?: string
  widget?: InputWidget
  forceInput?: boolean
}

export interface NodeOutput {
  id: string
  name: string
  type: ComfyType
  tooltip?: string
}

export interface ComfyNodeDef {
  id: string
  internalName: string
  displayName: string
  category: string
  description?: string
  inputs: NodeInput[]
  outputs: NodeOutput[]
  functionName: string
  isOutputNode: boolean
  isInputNode: boolean
  validateInputs: boolean
  isChangedMode: IsChangedMode
  executeBody: string
  usePackFolder: boolean
}

export interface Project {
  version: '1.0'
  name: string
  packName: string
  nodes: ComfyNodeDef[]
  createdAt: string
  updatedAt: string
}

export function createDefaultNode(overrides?: Partial<ComfyNodeDef>): ComfyNodeDef {
  return {
    id: crypto.randomUUID(),
    internalName: 'my_custom_node',
    displayName: 'My Custom Node',
    category: 'custom',
    description: '',
    inputs: [],
    outputs: [],
    functionName: 'execute',
    isOutputNode: false,
    isInputNode: false,
    validateInputs: false,
    isChangedMode: 'none',
    executeBody: '        pass',
    usePackFolder: true,
    ...overrides
  }
}

export function createDefaultInput(overrides?: Partial<NodeInput>): NodeInput {
  return {
    id: crypto.randomUUID(),
    name: 'input',
    type: 'IMAGE',
    required: true,
    tooltip: '',
    ...overrides
  }
}

export function createDefaultOutput(overrides?: Partial<NodeOutput>): NodeOutput {
  return {
    id: crypto.randomUUID(),
    name: 'output',
    type: 'IMAGE',
    tooltip: '',
    ...overrides
  }
}
