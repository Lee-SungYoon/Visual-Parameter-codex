
import { EffectDef, GlobalParams } from './types';

export const INITIAL_GLOBAL_PARAMS: GlobalParams = {
  hue: 180,
  saturation: 50,
  lightness: 50,
  effectColor: '#40bfbf', // HSL(180, 50, 50)
  gradientPreset: 0,
  bw: false,
  xray: false,
  thermal: false,
  invert: false,
  dramaticWarm: false,
  dramaticCool: false,
  mixMode: false,
  colorMix: false,
  exposure: 0,
  contrast: 1,
  vignette: 0,
  grain: 0,
  chromaticAberration: 0,
  duotone: false,
  applyTo: 'both', 
  maskStrength: 0.5,
  maskThreshold: 0.5,
  autoTracking: false,
};

export const GRADIENTS = [
  null,
  { name: 'Cyberpunk', colors: ['#ff00ff', '#00ffff'] },
  { name: 'Sunset', colors: ['#ff5f6d', '#ffc371'] },
  { name: 'Forest', colors: ['#11998e', '#38ef7d'] },
  { name: 'Ocean', colors: ['#2193b0', '#6dd5ed'] },
  { name: 'Royal', colors: ['#6441A5', '#2a0845'] }
];

export const EFFECTS: EffectDef[] = [
  {
    id: 'vortex',
    name: 'VORTEX',
    description: 'Rotating geometric rings reacting to luminance',
    defaultParams: {
      ringCount: 12,
      rotationSpeed: 1,
      shapeSides: 6,
      complexity: 0.5,
      expansion: 1.2
    },
    paramConfig: {
      ringCount: { type: 'slider', min: 3, max: 30, step: 1, randomRange: [8, 20] },
      rotationSpeed: { type: 'slider', min: -5, max: 5, step: 0.1, randomRange: [0.5, 2] },
      shapeSides: { type: 'slider', min: 3, max: 12, step: 1, randomRange: [3, 8] },
      complexity: { type: 'slider', min: 0.1, max: 2, step: 0.1, randomRange: [0.3, 1.2] },
      expansion: { type: 'slider', min: 0.5, max: 3, step: 0.1, randomRange: [1, 2] },
    },
  },
  {
    id: 'kaleido',
    name: 'KALEIDO',
    description: 'Radial geometric symmetry and tiling',
    defaultParams: {
      segments: 8,
      radius: 0.8,
      rotation: 0,
      zoom: 1.5,
      mirror: true
    },
    paramConfig: {
      segments: { type: 'slider', min: 2, max: 24, step: 1, randomRange: [6, 12] },
      radius: { type: 'slider', min: 0.1, max: 2, step: 0.1, randomRange: [0.5, 1.2] },
      rotation: { type: 'slider', min: 0, max: Math.PI * 2, step: 0.05, randomRange: [0, 3.14] },
      zoom: { type: 'slider', min: 0.5, max: 4, step: 0.1, randomRange: [1, 2.5] },
      mirror: { type: 'toggle' },
    },
  },
  {
    id: 'geometry',
    name: 'GEOMETRY',
    description: 'Recursive polygon tessellation and mesh grid',
    defaultParams: {
      gridSize: 25,
      recursive: 2,
      wireframe: false,
      shape: 'triangle',
      displacement: 15
    },
    paramConfig: {
      gridSize: { type: 'slider', min: 10, max: 60, step: 1, randomRange: [15, 35] },
      recursive: { type: 'slider', min: 0, max: 4, step: 1, randomRange: [1, 3] },
      wireframe: { type: 'toggle' },
      shape: { type: 'select', options: ['triangle', 'hexagon', 'rhombus'] },
      displacement: { type: 'slider', min: 0, max: 100, step: 1, randomRange: [10, 40] },
    },
  },
  {
    id: 'line',
    name: 'LINE',
    description: 'Dynamic edge-detected trails',
    defaultParams: {
      shapeType: 'arrow',
      threshold: 62.5,
      dotSize: 7.75,
      dotRandom: 0.5,
    },
    paramConfig: {
      shapeType: { type: 'select', options: ['arrow', 'dot', 'square', 'number', 'alphabet'] },
      threshold: { type: 'slider', min: 5, max: 120, step: 1, randomRange: [20, 70] },
      dotSize: { type: 'slider', min: 0.5, max: 15, step: 0.5, randomRange: [1, 5] },
      dotRandom: { type: 'slider', min: 0, max: 1, step: 0.1, randomRange: [0.1, 0.8] },
    },
  },
  {
    id: 'pixel',
    name: 'PIXEL',
    description: 'Retro pixelation',
    defaultParams: {
      pixelSize: 33,
      sizeVariance: 0.5,
      posterize: 6,
    },
    paramConfig: {
      pixelSize: { type: 'slider', min: 2, max: 64, step: 1, randomRange: [8, 24] },
      sizeVariance: { type: 'slider', min: 0, max: 1, step: 0.05, randomRange: [0, 0.5] },
    },
  },
  {
    id: 'halftone',
    name: 'HALFTONE',
    description: 'Dynamic dot pattern shading',
    defaultParams: {
      dotSize: 21,
      dotSizeRandom: 0.5,
      angle: 45,
    },
    paramConfig: {
      dotSize: { type: 'slider', min: 2, max: 40, step: 1, randomRange: [5, 20] },
      dotSizeRandom: { type: 'slider', min: 0, max: 1, step: 0.05, randomRange: [0.1, 0.5] },
    },
  },
  {
    id: 'plexus',
    name: 'PLEXUS',
    description: 'Vector-style network connectivity with technical guides',
    defaultParams: {
      shapeType: 'square',
      pointCount: 325,
      linkDistance: 80,
      lineWidth: 2.6,
      pointSize: 5.5,
      pointSizeRandom: 0.5,
      jitter: 10,
      showNumbers: true,
    },
    paramConfig: {
      shapeType: { type: 'select', options: ['arrow', 'dot', 'square', 'number', 'alphabet'] },
      pointCount: { type: 'slider', min: 50, max: 600, step: 10, randomRange: [150, 400] },
      linkDistance: { type: 'slider', min: 10, max: 150, step: 5, randomRange: [40, 90] },
      lineWidth: { type: 'slider', min: 0.2, max: 5, step: 0.1, randomRange: [0.5, 1.5] },
      pointSize: { type: 'slider', min: 1, max: 10, step: 0.5, randomRange: [3, 6] },
      pointSizeRandom: { type: 'slider', min: 0, max: 1, step: 0.05, randomRange: [0.1, 0.5] },
      jitter: { type: 'slider', min: 0, max: 20, step: 0.1, randomRange: [1, 5] },
      showNumbers: { type: 'toggle' },
    },
  },
  {
    id: 'matrix',
    name: 'MATRIX',
    description: 'Global digital rain with trails',
    defaultParams: {
      density: 225,
      fallSpeed: 7.75,
      fontSize: 23,
      language: 'random',
      showNumbers: false,
    },
    paramConfig: {
      density: { type: 'slider', min: 50, max: 400, step: 5, randomRange: [120, 250] },
      fallSpeed: { type: 'slider', min: 0.5, max: 15, step: 0.1, randomRange: [4, 9] },
      fontSize: { type: 'slider', min: 6, max: 40, step: 1, randomRange: [10, 18] },
      language: { type: 'select', options: ['random', 'en', 'jp', 'kr', 'cn', 'ar'] },
      showNumbers: { type: 'toggle' },
    },
  },
  {
    id: 'glitch',
    name: 'GLITCH',
    description: 'Massive Pixel Sorting glitch effect',
    defaultParams: {
      density: 45,
      size: 350,
      thickness: 8,
      threshold: 80,
    },
    paramConfig: {
      density: { type: 'slider', min: 1, max: 150, step: 1, randomRange: [30, 80] },
      size: { type: 'slider', min: 10, max: 800, step: 5, randomRange: [200, 500] },
      thickness: { type: 'slider', min: 1, max: 50, step: 1, randomRange: [4, 15] },
      threshold: { type: 'slider', min: 0, max: 255, step: 1, randomRange: [30, 120] },
    },
  },
  {
    id: 'kinetic_avoid',
    name: 'KINETIC AVOID',
    description: 'Object-aware kinetic blocks that flow around detected video objects',
    defaultParams: {
      density: 42,
      blockScale: 0.68,
      avoidRadius: 0.14,
      repelStrength: 0.85,
      driftSpeed: 1.2,
      colorMode: 'google',
    },
    paramConfig: {
      density: { type: 'slider', min: 16, max: 96, step: 1, randomRange: [32, 64] },
      blockScale: { type: 'slider', min: 0.3, max: 0.95, step: 0.05, randomRange: [0.45, 0.8] },
      avoidRadius: { type: 'slider', min: 0.03, max: 0.35, step: 0.01, randomRange: [0.08, 0.2] },
      repelStrength: { type: 'slider', min: 0, max: 1.8, step: 0.05, randomRange: [0.5, 1.2] },
      driftSpeed: { type: 'slider', min: 0, max: 4, step: 0.1, randomRange: [0.8, 2.4] },
      colorMode: { type: 'select', options: ['google', 'source', 'mono'] },
    },
  },
  {
    id: 'none',
    name: 'ORIGINAL',
    description: 'Clean source without generative effects',
    defaultParams: {},
    paramConfig: {},
  },
];
