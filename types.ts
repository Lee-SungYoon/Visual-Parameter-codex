
export type EffectId = 'vortex' | 'kaleido' | 'geometry' | 'plexus' | 'pixel' | 'halftone' | 'matrix' | 'glitch' | 'line' | 'kinetic_avoid' | 'none';

export type ApplyMode = 'subject' | 'background' | 'both';

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
}

export interface EffectDef {
  id: EffectId;
  name: string;
  description: string;
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
