import type { ComfyType } from '../types/node.types'

export interface ComfyTypeInfo {
  type: ComfyType
  label: string
  description: string
  color: string
  bgColor: string
  hex: string
}

export const COMFY_TYPE_INFO: ComfyTypeInfo[] = [
  // Common types — in priority order
  { type: 'IMAGE', label: 'Image', description: 'RGB image tensor (B, H, W, 3)', color: 'text-blue-400 border-blue-500/50', bgColor: 'bg-blue-900/30', hex: '#4488FF' },
  { type: 'SEED', label: 'Seed', description: 'Seed for random generation — name the input "seed" for ComfyUI to auto-add the Control After Generate widget. Generates as INT in code.', color: 'text-green-600 border-green-700/50', bgColor: 'bg-green-950/40', hex: '#2D8A2D' },
  { type: 'MODEL', label: 'Model', description: 'Diffusion model (UNet)', color: 'text-violet-400 border-violet-500/50', bgColor: 'bg-violet-900/30', hex: '#9966FF' },
  { type: 'CLIP', label: 'CLIP', description: 'CLIP text encoder model', color: 'text-yellow-400 border-yellow-500/50', bgColor: 'bg-yellow-900/30', hex: '#FFD500' },
  { type: 'VAE', label: 'VAE', description: 'Variational autoencoder', color: 'text-red-400 border-red-500/50', bgColor: 'bg-red-900/30', hex: '#FF4444' },
  { type: 'LATENT', label: 'Latent', description: 'Latent space representation', color: 'text-pink-300 border-pink-500/50', bgColor: 'bg-pink-900/30', hex: '#FF9CF9' },
  { type: 'CONDITIONING', label: 'Conditioning', description: 'Conditioning data for sampling', color: 'text-orange-400 border-orange-500/50', bgColor: 'bg-orange-900/30', hex: '#FFA931' },
  { type: 'MASK', label: 'Mask', description: 'Single-channel mask tensor (B, H, W)', color: 'text-emerald-400 border-emerald-500/50', bgColor: 'bg-emerald-900/30', hex: '#00CC66' },
  { type: 'INT', label: 'Integer', description: 'Integer number widget', color: 'text-green-600 border-green-700/50', bgColor: 'bg-green-950/40', hex: '#2D8A2D' },
  { type: 'FLOAT', label: 'Float', description: 'Floating-point number widget', color: 'text-green-400 border-green-500/50', bgColor: 'bg-green-900/30', hex: '#22A822' },
  { type: 'STRING', label: 'String', description: 'Text string widget', color: 'text-lime-400 border-lime-500/50', bgColor: 'bg-lime-900/30', hex: '#84CC16' },
  { type: 'BOOLEAN', label: 'Boolean', description: 'True/false toggle widget', color: 'text-red-400 border-red-500/50', bgColor: 'bg-red-900/30', hex: '#FF3333' },
  { type: 'COMBO', label: 'Combo', description: 'Dropdown selection widget', color: 'text-slate-400 border-slate-500/50', bgColor: 'bg-slate-800/30', hex: '#A0A0A0' },
  { type: '*', label: 'Any', description: 'Wildcard — accepts any type', color: 'text-slate-400 border-slate-500/50', bgColor: 'bg-slate-800/30', hex: '#A0A0A0' },
  // Alphabetical remainder
  { type: 'AUDIO', label: 'Audio', description: 'Audio waveform data', color: 'text-fuchsia-400 border-fuchsia-500/50', bgColor: 'bg-fuchsia-900/30', hex: '#FF00FF' },
  { type: 'CLIP_VISION', label: 'CLIP Vision', description: 'CLIP vision encoder model', color: 'text-blue-300 border-blue-400/50', bgColor: 'bg-blue-900/20', hex: '#88AAEE' },
  { type: 'CLIP_VISION_OUTPUT', label: 'CLIP Vision Output', description: 'Output from CLIP vision encoder', color: 'text-amber-700 border-amber-800/50', bgColor: 'bg-amber-950/40', hex: '#A0522D' },
  { type: 'CONTROL_NET', label: 'ControlNet', description: 'ControlNet model', color: 'text-teal-400 border-teal-500/50', bgColor: 'bg-teal-900/30', hex: '#00B89C' },
  { type: 'GLIGEN', label: 'GLIGEN', description: 'GLIGEN grounding data', color: 'text-yellow-200 border-yellow-400/50', bgColor: 'bg-yellow-900/20', hex: '#FFFF80' },
  { type: 'GUIDER', label: 'Guider', description: 'Sampling guider configuration', color: 'text-teal-500 border-teal-600/50', bgColor: 'bg-teal-900/40', hex: '#008B8B' },
  { type: 'NOISE', label: 'Noise', description: 'Noise generator', color: 'text-gray-500 border-gray-600/50', bgColor: 'bg-gray-900/40', hex: '#555555' },
  { type: 'SAMPLER', label: 'Sampler', description: 'Sampler configuration', color: 'text-red-300 border-red-400/50', bgColor: 'bg-red-900/20', hex: '#FF8080' },
  { type: 'SIGMAS', label: 'Sigmas', description: 'Noise schedule (sigma values)', color: 'text-green-300 border-green-400/50', bgColor: 'bg-green-900/20', hex: '#90EE90' },
  { type: 'STYLE_MODEL', label: 'Style Model', description: 'Style model for conditioning', color: 'text-green-300 border-green-400/50', bgColor: 'bg-green-900/20', hex: '#98FB98' },
  { type: 'UPSCALE_MODEL', label: 'Upscale Model', description: 'Image upscaling model', color: 'text-violet-300 border-violet-400/50', bgColor: 'bg-violet-900/20', hex: '#B5A0E5' },
]

const DEFAULT_TYPE_INFO: ComfyTypeInfo = {
  type: '*',
  label: 'Unknown',
  description: 'Unknown type',
  color: 'text-slate-400 border-slate-500/50',
  bgColor: 'bg-slate-800/30',
  hex: '#A0A0A0',
}

export function getTypeInfo(type: ComfyType): ComfyTypeInfo {
  return COMFY_TYPE_INFO.find((t) => t.type === type) ?? DEFAULT_TYPE_INFO
}

export function getTypeHex(type: ComfyType, overrides?: Record<string, string>): string {
  if (overrides && overrides[type]) return overrides[type]
  return getTypeInfo(type).hex
}

export const SUGGESTED_CATEGORIES = [
  'image',
  'image/transform',
  'image/filter',
  'image/color',
  'image/compositing',
  'latent',
  'latent/transform',
  'conditioning',
  'sampling',
  'loaders',
  'mask',
  'mask/compositing',
  'advanced',
  'advanced/model',
  'utils',
  'custom',
]
