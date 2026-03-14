import { describe, it, expect } from 'vitest'
import { generateAllFiles, buildLLMSystemPrompt, generateIndividualNodeFile } from './codeGenerator'
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
    expect(initPy).toContain('from .nodes.pack_nodes import')
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

// ─── generateIndividualNodeFile ──────────────────────────────────────────────

describe('generateIndividualNodeFile — basic node', () => {
  const node = makeNode({
    inputs: [{ id: '1', name: 'image', type: 'IMAGE', required: true }],
    outputs: [{ id: '2', name: 'result', type: 'IMAGE' }]
  })

  it('generates class definition and mappings', () => {
    const code = generateIndividualNodeFile(node, 'my_pack')
    expect(code).toContain('# My Test Node')
    expect(code).toContain('# Generated by ComfyNode Designer')
    expect(code).toContain('class my_test_node:')
    expect(code).toContain('NODE_CLASS_MAPPINGS = {"my_test_node": my_test_node}')
    expect(code).toContain('NODE_DISPLAY_NAME_MAPPINGS = {"my_test_node": "My Test Node"}')
    expect(code).toContain('__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]')
  })

  it('does not import from other modules', () => {
    const code = generateIndividualNodeFile(node, 'my_pack')
    expect(code).not.toContain('from .nodes')
    expect(code).not.toContain('import my_test_node')
  })
})

// ─── generateAllFiles — nodeFiles and initPyIndividual ───────────────────────

describe('generateAllFiles — nodeFiles', () => {
  it('populates nodeFiles record with the correct keys', () => {
    const nodes = [
      makeNode({ id: '1', internalName: 'node_a', displayName: 'Node A' }),
      makeNode({ id: '2', internalName: 'node_b', displayName: 'Node B' })
    ]
    const { nodeFiles } = generateAllFiles(nodes, 'test_pack')
    expect(Object.keys(nodeFiles)).toContain('node_a')
    expect(Object.keys(nodeFiles)).toContain('node_b')
    expect(nodeFiles['node_a']).toContain('class node_a:')
    expect(nodeFiles['node_b']).toContain('class node_b:')
  })

  it('initPyIndividual uses from .nodes.internalName import syntax', () => {
    const nodes = [
      makeNode({ id: '1', internalName: 'node_a', displayName: 'Node A' }),
      makeNode({ id: '2', internalName: 'node_b', displayName: 'Node B' })
    ]
    const { initPyIndividual } = generateAllFiles(nodes, 'test_pack')
    expect(initPyIndividual).toContain('from .nodes.node_a import NODE_CLASS_MAPPINGS as _m0')
    expect(initPyIndividual).toContain('from .nodes.node_b import NODE_CLASS_MAPPINGS as _m1')
    expect(initPyIndividual).toContain('NODE_CLASS_MAPPINGS = {**_m0, **_m1}')
    expect(initPyIndividual).toContain('NODE_DISPLAY_NAME_MAPPINGS = {**_d0, **_d1}')
  })

  it('nodeFiles record is empty for zero nodes', () => {
    const { nodeFiles, initPyIndividual } = generateAllFiles([], 'empty_pack')
    expect(Object.keys(nodeFiles)).toHaveLength(0)
    expect(initPyIndividual).toContain('NODE_CLASS_MAPPINGS = {}')
  })

  it('each nodeFile contains its own mappings only', () => {
    const nodes = [
      makeNode({ id: '1', internalName: 'alpha_node', displayName: 'Alpha Node' }),
      makeNode({ id: '2', internalName: 'beta_node', displayName: 'Beta Node' })
    ]
    const { nodeFiles } = generateAllFiles(nodes, 'test_pack')
    expect(nodeFiles['alpha_node']).toContain('"alpha_node": alpha_node')
    expect(nodeFiles['alpha_node']).not.toContain('beta_node')
    expect(nodeFiles['beta_node']).toContain('"beta_node": beta_node')
    expect(nodeFiles['beta_node']).not.toContain('alpha_node')
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
