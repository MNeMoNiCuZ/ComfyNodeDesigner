import { create } from 'zustand'
import { type ComfyNodeDef, type Project, createDefaultNode } from '../types/node.types'

interface ProjectState {
  project: Project
  selectedNodeId: string | null
  isDirty: boolean
  currentFilePath: string | null

  // Project-level actions
  setProject: (project: Project) => void
  openProject: (project: Project, filePath: string) => void
  setProjectName: (name: string) => void
  newProject: () => void

  // Node actions
  addNode: () => string
  deleteNode: (id: string) => void
  updateNode: (id: string, updates: Partial<ComfyNodeDef>) => void
  duplicateNode: (id: string) => void
  reorderNodes: (fromIndex: number, toIndex: number) => void
  selectNode: (id: string | null) => void
  importNodes: (nodes: ComfyNodeDef[]) => void

  // Persistence
  setDirty: (dirty: boolean) => void
  setCurrentFilePath: (path: string | null) => void
}

function createNewProject(name = 'Untitled Project'): Project {
  return {
    version: '1.0',
    name,
    nodes: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: createNewProject(),
  selectedNodeId: null,
  isDirty: false,
  currentFilePath: null,

  setProject: (project) => set({ project, isDirty: false, selectedNodeId: null }),

  openProject: (project, filePath) => set({ project, isDirty: false, currentFilePath: filePath, selectedNodeId: null }),

  setProjectName: (name) =>
    set((state) => ({
      project: { ...state.project, name, updatedAt: new Date().toISOString() },
      isDirty: true
    })),

  newProject: () =>
    set({
      project: createNewProject(),
      selectedNodeId: null,
      isDirty: false,
      currentFilePath: null
    }),

  addNode: () => {
    const node = createDefaultNode()
    set((state) => ({
      project: {
        ...state.project,
        nodes: [...state.project.nodes, node],
        updatedAt: new Date().toISOString()
      },
      selectedNodeId: node.id,
      isDirty: true
    }))
    return node.id
  },

  deleteNode: (id) =>
    set((state) => {
      const nodes = state.project.nodes.filter((n) => n.id !== id)
      const selectedNodeId =
        state.selectedNodeId === id ? (nodes.length > 0 ? nodes[nodes.length - 1].id : null) : state.selectedNodeId
      return {
        project: { ...state.project, nodes, updatedAt: new Date().toISOString() },
        selectedNodeId,
        isDirty: true
      }
    }),

  updateNode: (id, updates) =>
    set((state) => ({
      project: {
        ...state.project,
        nodes: state.project.nodes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
        updatedAt: new Date().toISOString()
      },
      isDirty: true
    })),

  duplicateNode: (id) => {
    const state = get()
    const node = state.project.nodes.find((n) => n.id === id)
    if (!node) return
    const newNode = createDefaultNode({
      ...node,
      id: crypto.randomUUID(),
      internalName: node.internalName + '_copy',
      displayName: node.displayName + ' (Copy)',
      inputs: node.inputs.map((i) => ({ ...i, id: crypto.randomUUID() })),
      outputs: node.outputs.map((o) => ({ ...o, id: crypto.randomUUID() }))
    })
    set((state) => ({
      project: {
        ...state.project,
        nodes: [...state.project.nodes, newNode],
        updatedAt: new Date().toISOString()
      },
      selectedNodeId: newNode.id,
      isDirty: true
    }))
  },

  reorderNodes: (fromIndex, toIndex) =>
    set((state) => {
      const nodes = [...state.project.nodes]
      const [moved] = nodes.splice(fromIndex, 1)
      nodes.splice(toIndex, 0, moved)
      return {
        project: { ...state.project, nodes, updatedAt: new Date().toISOString() },
        isDirty: true
      }
    }),

  selectNode: (id) => set({ selectedNodeId: id }),

  importNodes: (nodes) =>
    set((state) => ({
      project: {
        ...state.project,
        nodes: [...state.project.nodes, ...nodes],
        updatedAt: new Date().toISOString()
      },
      isDirty: true
    })),

  setDirty: (dirty) => set({ isDirty: dirty }),

  setCurrentFilePath: (path) => set({ currentFilePath: path })
}))

export function useSelectedNode(): ComfyNodeDef | null {
  const { project, selectedNodeId } = useProjectStore()
  if (!selectedNodeId) return null
  return project.nodes.find((n) => n.id === selectedNodeId) ?? null
}
