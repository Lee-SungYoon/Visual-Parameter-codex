
export type EffectId =
  | 'motion_trail'
  | 'rgb_shift'
  | 'neon_edge'
  | 'pixel_flow'
  | 'time_scan'
  | 'kinetic_plexus'
  | 'landmark_constellation'
  | 'tri_mesh'
  | 'edge_trace'
  | 'particle_drift'
  | 'ribbon_trails'
  | 'depth_field'
  | 'motion_particles'
  | 'depth_cloud'
  | 'vortex'
  | 'kaleido'
  | 'geometry'
  | 'plexus'
  | 'pixel'
  | 'halftone'
  | 'matrix'
  | 'glitch'
  | 'line'
  | 'kinetic_avoid'
  | 'none';

export type ApplyMode = 'entire' | 'person' | 'face' | 'hands' | 'background' | 'object' | 'motion' | 'depth' | 'subject' | 'both';
export type BlendMode = 'normal' | 'screen' | 'add' | 'multiply' | 'difference';
export type PreviewMode = 'original' | 'effect' | 'split' | 'before_after';
export type EffectStatus = 'Complete' | 'Lite' | 'Mock' | 'Planned';
export type GpuLoad = 'Low' | 'Medium' | 'High' | 'Experimental';
export type EffectCategory = 'video_effect' | 'reference_effect' | 'legacy';
export type GraphicStylePreset = 'minimal_white' | 'tech_green' | 'digital_blue' | 'luxury_gold' | 'monochrome' | 'custom';
export type AnimationMode = 'static' | 'float' | 'pulse' | 'follow_motion' | 'expand' | 'scan';

export interface GlobalParams {
  hue: number;
  saturation: number;
  lightness: number;
  effectColor: string;
  gradientPreset: number; // 0 for solid, 1-5 for presets
  bw: boolean;
  xray: boolean;
  thermal: boolean;
  invert: boolean;
  dramaticWarm: boolean;
  dramaticCool: boolean;
  mixMode: boolean;
  colorMix: boolean;
  exposure: number; // -1 to 1
  contrast: number; // 0.5 to 2
  vignette: number; // 0 to 1
  grain: number; // 0 to 1
  chromaticAberration: number; // 0 to 10
  duotone: boolean;
  applyTo: ApplyMode;
  maskStrength: number;
  maskThreshold: number; 
  autoTracking: boolean; 
  effectEnabled: boolean;
  effectAmount: number;
  target: ApplyMode;
  blendMode: BlendMode;
  originalMix: number;
  maskFeather: number;
  motionReactivity: number;
  speed: number;
  previewMode: PreviewMode;
  stylePreset: GraphicStylePreset;
  animationMode: AnimationMode;
}

export interface EffectDef {
  id: EffectId;
  name: string;
  description: string;
  category?: EffectCategory;
  status?: EffectStatus;
  gpuLoad?: GpuLoad;
  reference?: {
    label: string;
    url: string;
  };
  defaultParams: Record<string, number | string | boolean>;
  paramConfig: Record<string, ParamConfig>;
}

export interface ParamConfig {
  type: 'slider' | 'toggle' | 'select' | 'color';
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  randomRange?: [number, number]; 
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  loop: boolean;
  muted: boolean;
}

export interface NormalizedPoint {
  x: number;
  y: number;
  z?: number;
  confidence?: number;
}

export interface DetectedObject {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence?: number;
  label?: string;
}

export interface VisionFrameData {
  timestamp: number;
  frameWidth: number;
  frameHeight: number;
  faceLandmarks?: NormalizedPoint[];
  handLandmarks?: NormalizedPoint[][];
  poseLandmarks?: NormalizedPoint[];
  objectBoxes?: DetectedObject[];
  contours?: NormalizedPoint[][];
  motionVectors?: NormalizedPoint[];
}
