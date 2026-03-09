import { describe, it, expect } from 'vitest'
import { generateAllFiles, buildLLMSystemPrompt } from './codeGenerator'
import type { ComfyNodeDef } from '../../renderer/src/types/node.types'

function makeNode(overrides: Partial<ComfyNodeDef> = {}): ComfyNodeDef {
  return {
    id: 'test-id',
    internalName: 'my_test_node',
    displayName: 'My Test Node',
    category: 'testing',
    description: '',
    inputs: [],
    outputs: [],
    functionName: 'execute',
    isOutputNode: false,
    isInputNode: false,
    validateInputs: false,
    isChangedMode: 'none',
    executeBody: '',
    ...overrides
  }
}

// ─── generateAllFiles ────────────────────────────────────────────────────────

describe('generateAllFiles — empty project', () => {
  it('handles zero nodes gracefully', () => {
    const files = generateAllFiles([], 'my_pack')
    expect(files.singleFilePy).toContain('# No nodes defined')
    expect(files.nodesPy).toContain('# No nodes defined')
  })
})

describe('generateAllFiles — class structure', () => {
  const node = makeNode({
    inputs: [
      {
        id: '1',
        name: 'image',
        type: 'IMAGE',
        required: true,
        tooltip: 'The input image'
      }
    ],
    outputs: [{ id: '2', name: 'image', type: 'IMAGE', tooltip: '' }]
  })

  it('generates the class definition', () => {
    const { singleFilePy } = generateAllFiles([node], 'pack')
    expect(singleFilePy).toContain('class my_test_node:')
  })

  it('generates INPUT_TYPES classmethod', () => {
    const { singleFilePy } = generateAllFiles([node], 'pack')
    expect(singleFilePy).toContain('@classmethod')
    expect(singleFilePy).toContain('def INPUT_TYPES(cls):')
    expect(singleFilePy).toContain('"image": ("IMAGE",)')
  })

  it('generates RETURN_TYPES', () => {
    const { singleFilePy } = generateAllFiles([node], 'pack')
    expect(singleFilePy).toContain('RETURN_TYPES = ("IMAGE",)')
  })

  it('generates RETURN_NAMES', () => {
    const { singleFilePy } = generateAllFiles([node], 'pack')
    expect(singleFilePy).toContain('RETURN_NAMES = ("image",)')
  })

  it('generates FUNCTION and CATEGORY', () => {
    const { singleFilePy } = generateAllFiles([node], 'pack')
    expect(singleFilePy).toContain('FUNCTION = "execute"')
    expect(singleFilePy).toContain('CATEGORY = "testing"')
  })

  it('generates NODE_CLASS_MAPPINGS', () => {
    const { singleFilePy } = generateAllFiles([node], 'pack')
    expect(singleFilePy).toContain('"my_test_node": my_test_node')
  })

  it('generates NODE_DISPLAY_NAME_MAPPINGS', () => {
    const { singleFilePy } = generateAllFiles([node], 'pack')
    expect(singleFilePy).toContain('"my_test_node": "My Test Node"')
  })
})

describe('generateAllFiles — widget types', () => {
  it('generates INT widget with min/max/step', () => {
    const node = makeNode({
      inputs: [
        {
          id: '1',
          name: 'count',
          type: 'INT',
          required: true,
          widget: { min: 1, max: 100, step: 1, default: 10 }
        }
      ]
    })
    const { singleFilePy } = generateAllFiles([node], 'pack')
    expect(singleFilePy).toContain('"count": ("INT", {')
    expect(singleFilePy).toContain('"min": 1')
    expect(singleFilePy).toContain('"max": 100')
    expect(singleFilePy).toContain('"step": 1')
    expect(singleFilePy).toContain('"default": 10')
  })

  it('generates FLOAT widget with round', () => {
    const node = makeNode({
      inputs: [
        {
          id: '1',
          name: 'strength',
          type: 'FLOAT',
          required: true,
          widget: { min: 0.0, max: 1.0, step: 0.01, round: 0.001, default: 0.5 }
        }
      ]
    })
    const { singleFilePy } = generateAllFiles([node], 'pack')
    expect(singleFilePy).toContain('"strength": ("FLOAT", {')
    expect(singleFilePy).toContain('"round": 0.001')
  })

  it('generates STRING multiline widget', () => {
    const node = makeNode({
      inputs: [
        {
          id: '1',
          name: 'prompt',
          type: 'STRING',
          required: true,
          widget: { multiline: true, default: '' }
        }
      ]
    })
    const { singleFilePy } = generateAllFiles([node], 'pack')
    expect(singleFilePy).toContain('"prompt": ("STRING", {')
    expect(singleFilePy).toContain('"multiline": True')
  })

  it('generates COMBO with option list', () => {
    const node = makeNode({
      inputs: [
        {
          id: '1',
          name: 'mode',
          type: 'COMBO',
          required: true,
          widget: { comboOptions: ['linear', 'cosine', 'cubic'] }
        }
      ]
    })
    const { singleFilePy } = generateAllFiles([node], 'pack')
    expect(singleFilePy).toContain('"linear"')
    expect(singleFilePy).toContain('"cosine"')
    expect(singleFilePy).toContain('"cubic"')
  })
})

describe('generateAllFiles — optional inputs', () => {
  it('puts required inputs in required dict', () => {
    const node = makeNode({
      inputs: [{ id: '1', name: 'image', type: 'IMAGE', required: true }]
    })
    const { singleFilePy } = generateAllFiles([node], 'pack')
    expect(singleFilePy).toContain('"required"')
    expect(singleFilePy).not.toContain('"optional"')
  })

  it('puts optional inputs in optional dict', () => {
    const node = makeNode({
      inputs: [
        { id: '1', name: 'image', type: 'IMAGE', required: true },
        { id: '2', name: 'mask', type: 'MASK', required: false }
      ]
    })
    const { singleFilePy } = generateAllFiles([node], 'pack')
    expect(singleFilePy).toContain('"optional"')
    expect(singleFilePy).toContain('"mask"')
  })
})

describe('generateAllFiles — advanced flags', () => {
  it('adds OUTPUT_NODE = True', () => {
    const node = makeNode({ isOutputNode: true })
    const { singleFilePy } = generateAllFiles([node], 'pack')
    expect(singleFilePy).toContain('OUTPUT_NODE = True')
  })

  it('does not add OUTPUT_NODE when false', () => {
    const node = makeNode({ isOutputNode: false })
    const { singleFilePy } = generateAllFiles([node], 'pack')
    expect(singleFilePy).not.toContain('OUTPUT_NODE')
  })

  it('adds IS_CHANGED with time.time() when mode=always', () => {
    const node = makeNode({ isChangedMode: 'always' })
    const { singleFilePy } = generateAllFiles([node], 'pack')
    expect(singleFilePy).toContain('def IS_CHANGED')
    expect(singleFilePy).toContain('time.time()')
  })

  it('adds IS_CHANGED with md5 hash when mode=hash', () => {
    const node = makeNode({ isChangedMode: 'hash' })
    const { singleFilePy } = generateAllFiles([node], 'pack')
    expect(singleFilePy).toContain('def IS_CHANGED')
    expect(singleFilePy).toContain('hashlib')
  })

  it('adds VALIDATE_INPUTS stub when enabled', () => {
    const node = makeNode({ validateInputs: true })
    const { singleFilePy } = generateAllFiles([node], 'pack')
    expect(singleFilePy).toContain('def VALIDATE_INPUTS')
    expect(singleFilePy).toContain('return True')
  })
})

describe('generateAllFiles — execute body', () => {
  it('injects custom executeBody', () => {
    const node = makeNode({
      outputs: [{ id: '1', name: 'result', type: 'IMAGE' }],
      executeBody: '        result = image\n        return (result,)'
    })
    const { singleFilePy } = generateAllFiles([node], 'pack')
    expect(singleFilePy).toContain('result = image')
    expect(singleFilePy).toContain('return (result,)')
  })

  it('generates stub when executeBody is empty', () => {
    const node = makeNode({
      outputs: [{ id: '1', name: 'image', type: 'IMAGE' }],
      executeBody: ''
    })
    const { singleFilePy } = generateAllFiles([node], 'pack')
    expect(singleFilePy).toContain('# TODO: implement')
  })
})

describe('generateAllFiles — multiple nodes', () => {
  it('generates all classes in one file', () => {
    const nodes = [
      makeNode({ id: '1', internalName: 'node_a', displayName: 'Node A' }),
      makeNode({ id: '2', internalName: 'node_b', displayName: 'Node B' })
    ]
    const { singleFilePy } = generateAllFiles(nodes, 'pack')
    expect(singleFilePy).toContain('class node_a:')
    expect(singleFilePy).toContain('class node_b:')
    expect(singleFilePy).toContain('"node_a": node_a')
    expect(singleFilePy).toContain('"node_b": node_b')
  })
})

describe('generateAllFiles — package files', () => {
  it('generates __init__.py with imports', () => {
    const node = makeNode()
    const { initPy } = generateAllFiles([node], 'pack')
    expect(initPy).toContain('from .nodes import')
    expect(initPy).toContain('my_test_node')
    expect(initPy).toContain('NODE_CLASS_MAPPINGS')
    expect(initPy).toContain('NODE_DISPLAY_NAME_MAPPINGS')
  })

  it('generates README.md with node list', () => {
    const node = makeNode({ description: 'Does something useful' })
    const { readmeMd } = generateAllFiles([node], 'My Pack')
    expect(readmeMd).toContain('# My Pack')
    expect(readmeMd).toContain('My Test Node')
    expect(readmeMd).toContain('Does something useful')
  })
})

// ─── buildLLMSystemPrompt ────────────────────────────────────────────────────

describe('buildLLMSystemPrompt', () => {
  it('includes the node name and function signature', () => {
    const node = makeNode({
      inputs: [{ id: '1', name: 'image', type: 'IMAGE', required: true }],
      outputs: [{ id: '2', name: 'result', type: 'IMAGE' }]
    })
    const prompt = buildLLMSystemPrompt(node)
    expect(prompt).toContain('my_test_node')
    expect(prompt).toContain('def execute(self, image)')
    expect(prompt).toContain('image: IMAGE')
    expect(prompt).toContain('result: IMAGE')
  })

  it('marks optional inputs as optional', () => {
    const node = makeNode({
      inputs: [
        { id: '1', name: 'image', type: 'IMAGE', required: true },
        { id: '2', name: 'mask', type: 'MASK', required: false }
      ]
    })
    const prompt = buildLLMSystemPrompt(node)
    expect(prompt).toContain('[required]')
    expect(prompt).toContain('[optional]')
  })

  it('handles no outputs', () => {
    const node = makeNode({ outputs: [] })
    const prompt = buildLLMSystemPrompt(node)
    expect(prompt).toContain('RETURN_TYPES = ()')
  })
})
