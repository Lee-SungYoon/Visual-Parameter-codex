import { EffectId, GlobalParams } from '../types';

type SourceElement = HTMLImageElement | HTMLVideoElement;

interface ShaderRenderer {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  texture: WebGLTexture;
  buffer: WebGLBuffer;
  positionLocation: number;
  textureLocation: WebGLUniformLocation | null;
  resolutionLocation: WebGLUniformLocation | null;
  sourceResolutionLocation: WebGLUniformLocation | null;
  timeLocation: WebGLUniformLocation | null;
  effectLocation: WebGLUniformLocation | null;
  paramsLocation: WebGLUniformLocation | null;
  globalLocation: WebGLUniformLocation | null;
  commonLocation: WebGLUniformLocation | null;
  flagsLocation: WebGLUniformLocation | null;
  lookLocation: WebGLUniformLocation | null;
  colorLocation: WebGLUniformLocation | null;
  boxCountLocation: WebGLUniformLocation | null;
  boxesLocation: WebGLUniformLocation | null;
}

const EFFECT_INDEX: Record<EffectId, number> = {
  none: 0,
  motion_trail: 11,
  rgb_shift: 12,
  neon_edge: 13,
  pixel_flow: 14,
  time_scan: 15,
  kinetic_plexus: 18,
  landmark_constellation: 19,
  tri_mesh: 20,
  edge_trace: 21,
  particle_drift: 22,
  ribbon_trails: 23,
  depth_field: 24,
  motion_particles: 16,
  depth_cloud: 17,
  vortex: 1,
  kaleido: 2,
  geometry: 3,
  line: 4,
  pixel: 5,
  halftone: 6,
  plexus: 7,
  matrix: 8,
  glitch: 9,
  kinetic_avoid: 10,
};

const VERTEX_SHADER = `
attribute vec2 a_position;
varying vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `#extension GL_OES_standard_derivatives : enable
precision highp float;

uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform vec2 u_sourceResolution;
uniform float u_time;
uniform int u_effect;
uniform float u_params[10];
uniform vec4 u_global;
uniform vec4 u_common;
uniform vec4 u_flags;
uniform vec4 u_lookFlags;
uniform vec3 u_color;
uniform int u_boxCount;
uniform vec4 u_boxes[8];

varying vec2 v_uv;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float aaWidth(float value) {
  return max(fwidth(value), 0.0015);
}

float aaBand(float value, float edge) {
  float w = aaWidth(value);
  return 1.0 - smoothstep(edge - w, edge + w, value);
}

float aaRect(vec2 p, vec2 halfSize) {
  vec2 d = abs(p) - halfSize;
  float outside = length(max(d, 0.0));
  float inside = min(max(d.x, d.y), 0.0);
  float signedDistance = outside + inside;
  float w = max(fwidth(signedDistance), 0.0015);
  return 1.0 - smoothstep(-w, w, signedDistance);
}

float sdBox(vec2 p, vec2 halfSize) {
  vec2 d = abs(p) - halfSize;
  float outside = length(max(d, 0.0));
  float inside = min(max(d.x, d.y), 0.0);
  return outside + inside;
}

float sdBoxAA(vec2 p, vec2 halfSize) {
  float d = sdBox(p, halfSize);
  float w = max(fwidth(d), 0.0015);
  return 1.0 - smoothstep(0.0, w, d);
}

vec2 coverUv(vec2 uv) {
  float canvasAspect = u_resolution.x / max(u_resolution.y, 1.0);
  float sourceAspect = u_sourceResolution.x / max(u_sourceResolution.y, 1.0);
  vec2 outUv = uv;
  if (sourceAspect > canvasAspect) {
    float scale = canvasAspect / sourceAspect;
    outUv.x = (uv.x - 0.5) * scale + 0.5;
  } else {
    float scale = sourceAspect / canvasAspect;
    outUv.y = (uv.y - 0.5) * scale + 0.5;
  }
  return outUv;
}

vec3 thermal(vec3 color) {
  float luma = dot(color, vec3(0.299, 0.587, 0.114));
  return clamp(vec3(
    smoothstep(0.35, 0.95, luma),
    smoothstep(0.15, 0.75, luma) * (1.0 - smoothstep(0.85, 1.0, luma)),
    1.0 - smoothstep(0.2, 0.7, luma)
  ), 0.0, 1.0);
}

vec2 kaleidoUv(vec2 uv, float segments, float zoom, float rotation, float mirrorMix) {
  vec2 p = uv - 0.5;
  float r = length(p) / max(zoom, 0.001);
  float a = atan(p.y, p.x) + rotation + u_time * 0.18;
  float slice = 6.28318530718 / max(segments, 2.0);
  a = mod(a, slice);
  a = abs(a - slice * 0.5);
  if (mirrorMix > 0.5) {
    a = abs(a - slice * 0.25);
  }
  return vec2(cos(a), sin(a)) * r + 0.5;
}

vec4 sampleSource(vec2 uv) {
  return texture2D(u_texture, clamp(uv, vec2(0.001), vec2(0.999)));
}

float boxDistance(vec2 p, vec4 box) {
  vec2 center = box.xy + box.zw * 0.5;
  vec2 halfSize = box.zw * 0.5;
  vec2 q = abs(p - center) - halfSize;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}

vec2 repelFromBoxes(vec2 p, float radius, float strength) {
  vec2 offset = vec2(0.0);
  for (int i = 0; i < 8; i++) {
    if (i >= u_boxCount) break;
    vec4 box = u_boxes[i];
    vec2 center = box.xy + box.zw * 0.5;
    vec2 dir = p - center;
    float dist = max(boxDistance(p, box), 0.001);
    float influence = smoothstep(radius, 0.0, dist);
    offset += normalize(dir + vec2(0.0001)) * influence * strength * radius;
  }
  return offset;
}

float trackedMask(vec2 p, float feather) {
  if (u_boxCount == 0) {
    vec2 q = p - vec2(0.5);
    q.x *= u_resolution.x / max(u_resolution.y, 1.0);
    return 1.0 - smoothstep(0.28, 0.28 + feather, length(q));
  }
  float mask = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= u_boxCount) break;
    vec4 box = u_boxes[i];
    float d = boxDistance(p, box);
    mask = max(mask, 1.0 - smoothstep(0.0, max(feather, 0.001), d));
  }
  return clamp(mask, 0.0, 1.0);
}

vec2 trackedCenter() {
  if (u_boxCount == 0) return vec2(0.5);
  vec2 center = vec2(0.0);
  float weight = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= u_boxCount) break;
    vec4 box = u_boxes[i];
    float area = max(box.z * box.w, 0.001);
    center += (box.xy + box.zw * 0.5) * area;
    weight += area;
  }
  return center / max(weight, 0.001);
}

float gridPoint(vec2 p, float density, float radius, float jitter, float timeScale) {
  vec2 id = floor(p * density);
  vec2 local = fract(p * density) - 0.5;
  vec2 offset = vec2(hash(id), hash(id + 17.13)) - 0.5;
  offset += vec2(sin(u_time * timeScale + hash(id) * 6.2831), cos(u_time * timeScale + hash(id + 4.7) * 6.2831)) * jitter;
  return aaBand(length(local - offset * 0.55), radius);
}

float objectGlyph(vec2 local, vec2 cellId, float shapeType) {
  vec2 p = local - 0.5;
  if (shapeType < 0.5) {
    vec2 q = p;
    q.x += 0.08;
    float shaft = sdBox(q - vec2(0.08, -0.08), vec2(0.055, 0.34));
    float head = max(abs(q.x + q.y * 0.72) - 0.13, q.y - 0.16);
    float cursor = min(shaft, head);
    return 1.0 - smoothstep(0.0, max(fwidth(cursor), 0.002), cursor);
  }
  if (shapeType < 1.5) {
    float d = length(p);
    return 1.0 - smoothstep(0.18, 0.18 + max(fwidth(d), 0.002), d);
  }
  if (shapeType < 2.5) {
    return sdBoxAA(p, vec2(0.2));
  }
  if (shapeType < 3.5) {
    float h = hash(cellId);
    float barA = sdBoxAA(p - vec2(0.0, -0.17), vec2(0.16, 0.035));
    float barB = sdBoxAA(p - vec2(0.0, 0.17), vec2(0.16, 0.035));
    float left = sdBoxAA(p - vec2(-0.13, 0.0), vec2(0.035, 0.17));
    float right = sdBoxAA(p - vec2(0.13, 0.0), vec2(0.035, 0.17));
    float mid = sdBoxAA(p, vec2(0.14, 0.03));
    return max(max(barA, barB), max(mix(left, right, step(0.5, h)), mid * step(0.32, h)));
  }
  float stem = sdBoxAA(p - vec2(-0.12, 0.0), vec2(0.035, 0.24));
  float cross = sdBoxAA(p - vec2(0.04, 0.14), vec2(0.16, 0.035));
  float diagD = abs((p.y + 0.17) - (p.x + 0.12) * 1.35);
  float diag = 1.0 - smoothstep(0.0, 0.025 + fwidth(diagD), diagD);
  diag *= smoothstep(-0.18, -0.08, p.x) * (1.0 - smoothstep(0.16, 0.26, p.x));
  return max(max(stem, cross), diag);
}

void main() {
  vec2 uv = coverUv(v_uv);
  vec2 effectUv = uv;
  vec2 centered = uv - 0.5;
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  float animMode = u_flags.w;
  float animPulse = animMode > 1.5 && animMode < 2.5 ? 0.65 + 0.35 * sin(u_time * 3.4) : 1.0;
  float animScan = animMode > 4.5 ? smoothstep(0.0, 0.22, fract(v_uv.y + u_time * 0.35)) : 1.0;
  float animExpand = animMode > 3.5 && animMode < 4.5 ? smoothstep(0.0, 0.45, length(v_uv - trackedCenter()) + sin(u_time) * 0.08) : 1.0;
  centered.x *= aspect;

  if (u_effect == 1) {
    float speed = u_params[1];
    float complexity = u_params[3];
    float expansion = max(u_params[4], 0.1);
    float radius = length(centered);
    float angle = atan(centered.y, centered.x);
    angle += (1.0 - smoothstep(0.0, expansion, radius)) * (u_time * speed + radius * complexity * 8.0);
    effectUv = vec2(cos(angle) * radius / aspect, sin(angle) * radius) + 0.5;
  } else if (u_effect == 2) {
    effectUv = kaleidoUv(uv, u_params[0], u_params[3], u_params[2], u_params[4]);
  } else if (u_effect == 3) {
    vec2 c = trackedCenter();
    float subject = trackedMask(uv, 0.18);
    vec2 p = (uv - c) * u_resolution / max(u_params[0], 8.0);
    vec2 local = fract(p) - 0.5;
    float cellWave = sin((floor(p.x) * 1.37 + floor(p.y) * 1.91) + u_time * 0.85);
    effectUv += normalize(local + vec2(0.0001)) * cellWave * u_params[3] * 0.0018 * (0.35 + subject);
  } else if (u_effect == 4) {
    float edgeProbe = length(sampleSource(uv + vec2(0.002, 0.0)).rgb - sampleSource(uv - vec2(0.002, 0.0)).rgb);
    edgeProbe += length(sampleSource(uv + vec2(0.0, 0.002)).rgb - sampleSource(uv - vec2(0.0, 0.002)).rgb);
    float subject = trackedMask(uv, 0.14);
    vec2 c = trackedCenter();
    effectUv += normalize(uv - c + vec2(0.0001)) * smoothstep(u_params[1] / 255.0, 0.45, edgeProbe) * u_params[2] * 0.0016 * (0.4 + subject);
  } else if (u_effect == 5) {
    float size = max(u_params[0], 2.0);
    vec2 grid = vec2(size) / u_resolution;
    effectUv = (floor(uv / grid) + 0.5) * grid;
  } else if (u_effect == 6) {
    vec2 c = trackedCenter();
    float subject = trackedMask(uv, 0.2);
    float dotSize = max(u_params[0], 4.0);
    vec2 grid = floor((uv + (uv - c) * subject * 0.025) * u_resolution / dotSize);
    vec2 jitter = vec2(hash(grid), hash(grid + 4.7)) - 0.5;
    effectUv += jitter * u_params[1] * dotSize / u_resolution * 0.75;
  } else if (u_effect == 7) {
    vec2 c = trackedCenter();
    float subject = trackedMask(uv, 0.22);
    float density = mix(18.0, 95.0, clamp(u_params[1] / 600.0, 0.0, 1.0));
    vec2 grid = floor(uv * density);
    vec2 jitter = vec2(hash(grid + u_time * 0.18), hash(grid + 9.31 + u_time * 0.12)) - 0.5;
    effectUv += ((uv - c) * subject * 0.035) + jitter * u_params[5] * 0.0008;
  } else if (u_effect == 9) {
    float density = max(u_params[0], 1.0);
    float amount = u_params[1] / 800.0;
    float band = floor(uv.y * density);
    float offset = (hash(vec2(band, floor(u_time * 18.0))) - 0.5) * amount;
    effectUv.x += offset;
  } else if (u_effect == 10) {
    float radius = max(u_params[2], 0.01);
    float strength = max(u_params[3], 0.0);
    effectUv += repelFromBoxes(uv, radius, strength);
  } else if (u_effect == 11) {
    float scale = max(u_params[3], 0.9);
    float rotation = u_params[4] + sin(u_time * 0.7) * u_params[6] * 0.018;
    vec2 p = uv - 0.5;
    mat2 rot = mat2(cos(rotation), -sin(rotation), sin(rotation), cos(rotation));
    effectUv = rot * (p / scale) + 0.5;
  } else if (u_effect == 12) {
    float distortion = u_params[4];
    float r = length(centered);
    effectUv += centered * r * distortion * 0.08;
  } else if (u_effect == 14) {
    float direction = u_params[0];
    float threshold = u_params[1];
    float stretch = u_params[6] * 0.16;
    float wave = sin((uv.y + uv.x * 0.3 + u_time * u_params[5] * 0.08) * 80.0) * u_params[4] * 0.01;
    float sourceLuma = dot(sampleSource(uv).rgb, vec3(0.299, 0.587, 0.114));
    vec2 radialDir = normalize(centered + vec2(0.0001));
    if (direction < 0.5) {
      effectUv.x += step(threshold, sourceLuma) * stretch + wave;
    } else if (direction < 1.5) {
      effectUv.y += step(threshold, sourceLuma) * stretch + wave;
    } else {
      effectUv += radialDir * (step(threshold, sourceLuma) * stretch + wave);
    }
  } else if (u_effect == 15) {
    float direction = u_params[1];
    float sourceLuma = dot(sampleSource(uv).rgb, vec3(0.299, 0.587, 0.114));
    float noiseA = hash(floor((uv + u_time * 0.035) * (70.0 + u_params[4] * 35.0)));
    float noiseB = hash(floor((uv.yx - u_time * 0.028) * (42.0 + u_params[4] * 22.0)));
    vec2 noiseVec = vec2(noiseA - 0.5, noiseB - 0.5);
    vec2 scanDir = direction < 0.5 ? vec2(1.0, 0.0) : (direction < 1.5 ? vec2(0.0, 1.0) : normalize(centered + vec2(0.0001)));
    float displacement = (noiseA * 0.65 + sourceLuma * 0.35) * u_params[0] * (0.018 + u_params[5] * 0.045);
    float softGate = smoothstep(0.0, 0.65, trackedMask(uv, 0.22) + abs(noiseA - noiseB));
    effectUv += (scanDir * displacement + noiseVec * displacement * 0.85) * softGate;
  } else if (u_effect == 17) {
    float sourceLuma = dot(sampleSource(uv).rgb, vec3(0.299, 0.587, 0.114));
    float depth = sourceLuma * u_params[0];
    vec2 orbit = vec2(cos(u_time * u_params[6]), sin(u_time * u_params[6])) * depth * u_params[3] * 0.08;
    effectUv += orbit + (hash(floor(uv * 90.0)) - 0.5) * u_params[5] * 0.01;
  } else if (u_effect == 24) {
    float sourceLuma = dot(sampleSource(uv).rgb, vec3(0.299, 0.587, 0.114));
    vec2 center = trackedCenter();
    vec2 parallax = (uv - center) * sourceLuma * u_params[3] * 0.22;
    parallax += vec2(sin(u_time * u_params[4]), cos(u_time * u_params[4] * 0.7)) * sourceLuma * 0.025;
    effectUv += parallax;
  }

  vec4 base = sampleSource(effectUv);
  vec3 originalColor = sampleSource(uv).rgb;
  vec3 color = base.rgb;
  float luma = dot(color, vec3(0.299, 0.587, 0.114));

  if (u_effect == 11) {
    float trail = clamp(u_params[0], 0.0, 1.0);
    float decay = clamp(u_params[1], 0.0, 1.0);
    float blur = u_params[2];
    float glow = u_params[5];
    vec2 px = 1.0 / u_resolution * (1.0 + blur * 7.0);
    vec3 echoA = sampleSource(effectUv + vec2(px.x, 0.0)).rgb;
    vec3 echoB = sampleSource(effectUv - vec2(0.0, px.y)).rgb;
    vec3 echoC = sampleSource(effectUv + vec2(-px.x, px.y)).rgb;
    vec3 feedback = (echoA + echoB + echoC) / 3.0;
    float bright = smoothstep(0.35, 1.0, dot(feedback, vec3(0.299, 0.587, 0.114)));
    float focus = trackedMask(uv, 0.16);
    float shadow = 1.0 - smoothstep(0.08, 0.42, dot(feedback, vec3(0.299, 0.587, 0.114)));
    vec3 invertedTrail = mix(1.0 - originalColor, 1.0 - feedback, 0.55);
    vec3 trailBase = mix(feedback, invertedTrail, shadow * (0.55 + decay * 0.35));
    color = mix(color, trailBase * (1.0 - decay * 0.18) + u_color * bright * glow, trail * (0.35 + focus * 0.85));
  } else if (u_effect == 12) {
    float amount = u_params[0];
    float direction = u_params[1];
    float radial = u_params[2];
    float jitter = (hash(vec2(floor(u_time * 34.0), uv.y * 17.0)) - 0.5) * u_params[3] * 0.028;
    vec2 dir = direction < 0.5 ? vec2(1.0, 0.0) : (direction < 1.5 ? vec2(0.0, 1.0) : (direction < 2.5 ? normalize(vec2(1.0, 1.0)) : normalize(centered + vec2(0.0001))));
    vec2 radialDir = normalize(centered + vec2(0.0001)) * radial;
    vec2 offset = (dir + radialDir) * amount * 1.45 + jitter;
    vec3 shifted = vec3(
      sampleSource(effectUv + offset * 1.25).r,
      sampleSource(effectUv - offset * 0.35).g,
      sampleSource(effectUv - offset * 1.25).b
    );
    vec2 px = 1.0 / u_resolution;
    float edge = length(sampleSource(effectUv + vec2(px.x, 0.0)).rgb - sampleSource(effectUv - vec2(px.x, 0.0)).rgb);
    edge += length(sampleSource(effectUv + vec2(0.0, px.y)).rgb - sampleSource(effectUv - vec2(0.0, px.y)).rgb);
    float focus = trackedMask(uv, 0.16);
    float movingEdge = smoothstep(0.045, 0.2, edge);
    float edgeMask = u_params[6] > 0.5 ? movingEdge : 1.0;
    edgeMask = max(edgeMask, focus * 0.78);
    vec3 separated = shifted + vec3(shifted.r - color.r, shifted.g - color.g, shifted.b - color.b) * (0.65 + movingEdge * 0.55);
    separated.r = max(separated.r, sampleSource(effectUv + offset * 1.7).r * movingEdge);
    separated.g = max(separated.g, sampleSource(effectUv - offset * 0.65).g * focus);
    separated.b = max(separated.b, sampleSource(effectUv - offset * 1.7).b * movingEdge);
    color = mix(color, separated, clamp(edgeMask * (0.88 + u_params[5] * 0.28), 0.0, 1.0));
  } else if (u_effect == 13) {
    float thickness = max(u_params[0], 0.5);
    float threshold = u_params[1];
    float glow = u_params[2];
    float trail = u_params[3];
    float growth = u_params[4];
    float dim = u_params[5];
    vec2 px = 1.0 / u_resolution * thickness;
    float tl = dot(sampleSource(effectUv + px * vec2(-1.0, -1.0)).rgb, vec3(0.299, 0.587, 0.114));
    float tc = dot(sampleSource(effectUv + px * vec2(0.0, -1.0)).rgb, vec3(0.299, 0.587, 0.114));
    float tr = dot(sampleSource(effectUv + px * vec2(1.0, -1.0)).rgb, vec3(0.299, 0.587, 0.114));
    float ml = dot(sampleSource(effectUv + px * vec2(-1.0, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
    float mr = dot(sampleSource(effectUv + px * vec2(1.0, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
    float bl = dot(sampleSource(effectUv + px * vec2(-1.0, 1.0)).rgb, vec3(0.299, 0.587, 0.114));
    float bc = dot(sampleSource(effectUv + px * vec2(0.0, 1.0)).rgb, vec3(0.299, 0.587, 0.114));
    float br = dot(sampleSource(effectUv + px * vec2(1.0, 1.0)).rgb, vec3(0.299, 0.587, 0.114));
    float gx = -tl - 2.0 * ml - bl + tr + 2.0 * mr + br;
    float gy = -tl - 2.0 * tc - tr + bl + 2.0 * bc + br;
    float edge = length(vec2(gx, gy));
    float stroke = smoothstep(threshold, threshold + 0.18, edge);
    float aura = smoothstep(threshold * 0.35, threshold + 0.35 + growth, edge) * glow;
    vec3 neon = u_color * (stroke + aura * 0.55 + trail * 0.25);
    float focus = trackedMask(uv, 0.12);
    neon += u_color * focus * glow * 0.35;
    color = mix(color * (1.0 - dim * (0.35 + focus)), neon, clamp(stroke + aura + focus * 0.28, 0.0, 1.0));
  } else if (u_effect == 3) {
    float gridSize = max(u_params[0], 8.0);
    float shapeMode = u_params[4];
    vec2 c = trackedCenter();
    vec2 p = (v_uv - c) * u_resolution / gridSize;
    p += vec2(sin(u_time * 0.32), cos(u_time * 0.27)) * u_params[3] * 0.018;
    vec2 cell = floor(p);
    vec2 local = fract(p) - 0.5;
    float triLine = min(abs(local.y + local.x * 0.866), min(abs(local.y - local.x * 0.866), abs(local.y + 0.32)));
    float hexLine = abs(length(local) - 0.32);
    float rhombusLine = abs(abs(local.x) + abs(local.y) - 0.36);
    float shapeLine = shapeMode < 0.5 ? triLine : (shapeMode < 1.5 ? hexLine : rhombusLine);
    float wire = 1.0 - smoothstep(0.0, 0.026 + fwidth(shapeLine), shapeLine);
    float fill = 1.0 - smoothstep(0.28, 0.38, length(local));
    float subject = trackedMask(v_uv, 0.14);
    float pulse = 0.55 + 0.45 * sin(u_time * 2.0 + hash(cell) * 6.2831 + luma * 8.0);
    float recursive = 1.0 + u_params[1] * 0.18;
    float geo = u_params[2] > 0.5 ? wire : max(wire, fill * 0.22 * recursive);
    vec3 cellTone = sampleSource(effectUv + normalize(local + vec2(0.0001)) * geo * 0.006).rgb;
    vec3 shapedVideo = mix(cellTone * (0.72 + pulse * 0.35), cellTone * (0.95 + u_color * 0.55), geo);
    color = mix(color, shapedVideo, geo * (0.65 + subject * 0.35));
  } else if (u_effect == 4) {
    vec2 px = 1.0 / u_resolution;
    float edge = length(sampleSource(effectUv + vec2(px.x, 0.0)).rgb - sampleSource(effectUv - vec2(px.x, 0.0)).rgb);
    edge += length(sampleSource(effectUv + vec2(0.0, px.y)).rgb - sampleSource(effectUv - vec2(0.0, px.y)).rgb);
    edge += length(sampleSource(effectUv + px).rgb - sampleSource(effectUv - px).rgb) * 0.5;
    edge *= 0.65;
    float shapeType = u_params[0];
    float threshold = u_params[1] / 255.0;
    float dotSize = max(u_params[2], 1.0);
    float randomAmount = clamp(u_params[3], 0.0, 1.0);
    float edgeMask = smoothstep(threshold, threshold + 0.12, edge);
    vec2 center = trackedCenter();
    vec2 drift = (v_uv - center) * trackedMask(v_uv, 0.18) * (0.8 + randomAmount) + vec2(sin(u_time * 0.9), cos(u_time * 0.7)) * 0.018;
    vec2 gridScale = u_resolution / dotSize;
    vec2 cellId = floor((v_uv + drift * 0.035) * gridScale);
    vec2 local = fract((v_uv + drift * 0.035) * gridScale);
    float jitter = (hash(cellId + floor(u_time * 8.0)) - 0.5) * randomAmount * 0.28;
    local += vec2(jitter, jitter * 0.55);
    float glyph = objectGlyph(local, cellId, shapeType);
    float focus = trackedMask(uv, 0.1);
    float objectMask = glyph * max(edgeMask, focus * 0.62);
    float halo = smoothstep(threshold * 0.45, threshold + 0.2, edge) * 0.28;
    vec3 warpedVideo = sampleSource(effectUv + (local - 0.5) * objectMask * dotSize / u_resolution * 0.9).rgb;
    vec3 objectTintedVideo = mix(warpedVideo, warpedVideo * (0.78 + u_color * 0.72), clamp(objectMask + halo, 0.0, 1.0));
    color = mix(color, objectTintedVideo, clamp(objectMask + halo * 0.7, 0.0, 1.0));
  } else if (u_effect == 6) {
    float dotSize = max(u_params[0], 4.0);
    vec2 c = trackedCenter();
    float subject = trackedMask(v_uv, 0.2);
    vec2 px = 1.0 / u_resolution;
    float edge = length(sampleSource(effectUv + vec2(px.x, 0.0)).rgb - sampleSource(effectUv - vec2(px.x, 0.0)).rgb);
    edge += length(sampleSource(effectUv + vec2(0.0, px.y)).rgb - sampleSource(effectUv - vec2(0.0, px.y)).rgb);
    float motionEdge = smoothstep(0.06, 0.26, edge);
    float angle = radians(u_params[2]);
    mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
    vec2 motion = (v_uv - c) * subject * (0.035 + motionEdge * 0.055) + vec2(sin(u_time * 0.55), cos(u_time * 0.43)) * u_params[1] * 0.018;
    vec2 halftoneGrid = rot * ((v_uv + motion) * u_resolution / dotSize);
    vec2 cell = fract(halftoneGrid) - 0.5;
    float cellHash = hash(floor(halftoneGrid));
    float sizeClass = smoothstep(0.16, 0.88, luma + motionEdge * 0.35 + subject * 0.18);
    float radius = mix(0.11, 0.36, sizeClass);
    radius *= mix(1.0 - u_params[1] * 0.28, 1.0 + u_params[1] * 0.18, cellHash);
    radius = clamp(radius, 0.09, 0.38);
    float dot = 1.0 - smoothstep(radius, radius + 0.035, length(cell));
    vec3 dotVideo = sampleSource(effectUv + cell * dotSize / u_resolution * dot * 0.28).rgb;
    vec3 invertedDotVideo = 1.0 - dotVideo;
    invertedDotVideo = mix(invertedDotVideo, invertedDotVideo * (0.82 + u_color * 0.38), motionEdge * 0.35);
    color = mix(color, invertedDotVideo, dot * (0.82 + subject * 0.12 + motionEdge * 0.18));
  } else if (u_effect == 7) {
    float density = mix(18.0, 95.0, clamp(u_params[1] / 600.0, 0.0, 1.0));
    vec2 c = trackedCenter();
    float subject = trackedMask(v_uv, 0.22);
    vec2 px = 1.0 / u_resolution;
    float edge = length(sampleSource(effectUv + vec2(px.x, 0.0)).rgb - sampleSource(effectUv - vec2(px.x, 0.0)).rgb);
    edge += length(sampleSource(effectUv + vec2(0.0, px.y)).rgb - sampleSource(effectUv - vec2(0.0, px.y)).rgb);
    edge += length(sampleSource(effectUv + px).rgb - sampleSource(effectUv - px).rgb) * 0.35;
    float movingEdge = smoothstep(0.045, 0.22, edge) * (0.35 + subject * 0.65);
    vec2 flow = (v_uv - c) * movingEdge * 0.11 + vec2(sin(u_time * 0.42), cos(u_time * 0.36)) * u_params[5] * 0.002;
    vec2 p = (v_uv + flow) * density;
    vec2 cell = floor(p);
    vec2 local = fract(p);
    float h = hash(cell);
    float pointRadius = max(u_params[4] * 0.014, 0.018) * (1.0 + u_params[6] * (h - 0.5));
    float point = aaBand(length(local - 0.5), pointRadius) * movingEdge;
    float vertical = aaBand(abs(local.x - 0.5), 0.01 * max(u_params[3], 0.5)) * step(abs(local.y - 0.5), u_params[2] * 0.01);
    float horizontal = aaBand(abs(local.y - 0.5), 0.01 * max(u_params[3], 0.5)) * step(abs(local.x - 0.5), u_params[2] * 0.01);
    float link = max(vertical, horizontal) * movingEdge;
    float idGlyph = u_params[7] > 0.5 ? objectGlyph(fract(p * 1.7), cell, 3.0) * 0.28 * movingEdge : 0.0;
    float plexMask = clamp(point + link * 0.78 + idGlyph, 0.0, 1.0);
    vec3 plexVideo = sampleSource(effectUv + (local - 0.5) * plexMask * 0.018).rgb;
    plexVideo = mix(plexVideo, plexVideo * (0.78 + u_color * (0.42 + h * 0.28)), plexMask);
    color = mix(color, plexVideo, plexMask);
  } else if (u_effect == 8) {
    float density = max(u_params[0] * 0.08, 6.0);
    vec2 cell = floor(v_uv * vec2(density, density * 1.6));
    float stream = hash(vec2(cell.x, 1.7));
    float fall = fract(stream + u_time * max(u_params[1], 0.5) * 0.12);
    float trail = smoothstep(0.0, 0.18, 1.0 - abs(fract(v_uv.y * density * 1.6) - fall));
    float glyph = step(0.66, hash(cell + floor(u_time * 12.0)));
    vec3 matrixVideo = mix(color * 0.35, color * (0.65 + u_color * 0.75), glyph);
    color = mix(color, matrixVideo, trail * (0.45 + glyph * 0.55));
  } else if (u_effect == 9) {
    float amount = max(u_params[2], 1.0) / 500.0;
    vec3 split;
    split.r = sampleSource(effectUv + vec2(amount, 0.0)).r;
    split.g = color.g;
    split.b = sampleSource(effectUv - vec2(amount, 0.0)).b;
    color = mix(color, split, 0.85);
  } else if (u_effect == 10) {
    float density = max(u_params[0], 8.0);
    float blockScale = clamp(u_params[1], 0.2, 1.0);
    float speed = u_params[4];
    float mode = u_params[5];
    vec2 drift = vec2(sin(u_time * 0.37), cos(u_time * 0.29)) * speed;
    vec2 gridUv = v_uv * vec2(density * aspect, density) + drift;
    vec2 cell = floor(gridUv);
    vec2 local = fract(gridUv) - 0.5;
    float angle = (hash(cell) - 0.5) * 1.4 + sin(u_time * speed + hash(cell) * 6.2831) * 0.28;
    mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
    vec2 brick = rot * local;
    float rect = aaRect(brick, vec2(0.18, 0.48) * blockScale);
    float avoid = 0.0;
    for (int i = 0; i < 8; i++) {
      if (i >= u_boxCount) break;
      avoid = max(avoid, 1.0 - smoothstep(0.0, max(u_params[2], 0.01), boxDistance(v_uv, u_boxes[i])));
    }
    vec3 googleA = vec3(0.271, 0.557, 0.961);
    vec3 googleB = vec3(0.953, 0.329, 0.313);
    vec3 googleC = vec3(0.953, 0.765, 0.082);
    vec3 googleD = vec3(0.035, 0.690, 0.361);
    float pick = hash(cell);
    vec3 blockColor = pick < 0.25 ? googleA : (pick < 0.5 ? googleB : (pick < 0.75 ? googleC : googleD));
    blockColor = mode > 1.5 ? u_color : (mode > 0.5 ? mix(color, u_color, 0.35) : blockColor);
    vec3 blockVideo = mode > 1.5 ? color * (0.72 + u_color * 0.6) : (mode > 0.5 ? mix(color, color * (0.75 + u_color * 0.45), 0.55) : color * mix(blockColor, vec3(1.0), 0.45));
    color = mix(color, blockVideo, rect * (1.0 - avoid * 0.82));
    color = mix(color, color * (0.92 + u_color * 0.2), smoothstep(0.9, 0.0, abs(avoid - 0.36)) * 0.25);
  } else if (u_effect == 14) {
    float subject = trackedMask(v_uv, 0.16);
    float gate = smoothstep(u_params[1], 1.0, luma);
    vec3 flowVideo = sampleSource(effectUv + normalize(effectUv - trackedCenter() + vec2(0.0001)) * gate * subject * u_params[6] * 0.018).rgb;
    color = mix(color, flowVideo * (0.9 + u_color * 0.28), gate * subject * 0.72);
  } else if (u_effect == 15) {
    float direction = u_params[1];
    float subject = trackedMask(v_uv, 0.18);
    vec2 scanDir = direction < 0.5 ? vec2(1.0, 0.0) : (direction < 1.5 ? vec2(0.0, 1.0) : normalize(centered + vec2(0.0001)));
    float softDelay = 0.5 + 0.5 * sin(u_time * u_params[3] + dot(v_uv, scanDir.yx) * 8.0);
    vec3 scanVideo = sampleSource(effectUv + scanDir * softDelay * subject * u_params[0] * 0.035).rgb;
    color = mix(color, scanVideo * (0.88 + u_color * 0.22), subject * (0.45 + u_params[0] * 0.35));
  } else if (u_effect == 16) {
    float count = max(u_params[0] * 0.018, 6.0);
    float size = u_params[1] * 0.01;
    float turbulence = u_params[4];
    vec2 flowUv = v_uv * count + vec2(sin(u_time * 0.7), cos(u_time * 0.9)) * turbulence;
    vec2 cell = floor(flowUv);
    vec2 local = fract(flowUv) - 0.5;
    float spin = u_params[7] > 2.5 ? length(local) : dot(local, normalize(vec2(sin(u_time), cos(u_time))));
    float particle = aaBand(length(local + vec2(sin(hash(cell) * 6.28 + u_time), cos(hash(cell) * 6.28 + u_time)) * 0.18), max(size, 0.015));
    float motionGate = smoothstep(u_params[6], 1.0, abs(sin(hash(cell) * 8.0 + u_time * u_params[2])));
    color = mix(color * 0.35, u_color + vec3(spin * 0.25), particle * motionGate * u_params[5]);
  } else if (u_effect == 17) {
    float density = mix(18.0, 110.0, clamp(u_params[2], 0.0, 1.0));
    vec2 cellUv = fract(v_uv * density) - 0.5;
    float point = aaBand(length(cellUv), max(u_params[1] * 0.012, 0.01));
    float depth = luma * u_params[0];
    vec3 cloud = mix(u_color * 0.35, color + u_color * 0.4, depth);
    color = mix(color * u_params[7], cloud, point);
  } else if (u_effect == 18) {
    float density = mix(18.0, 82.0, clamp(u_params[0] / 260.0, 0.0, 1.0));
    float subject = trackedMask(v_uv, 0.12);
    float point = gridPoint(v_uv + sin(u_time * 0.35) * 0.006, density, u_params[1] * 0.018, u_params[5] * 2.0, 1.2);
    vec2 grid = fract(v_uv * density) - 0.5;
    float vertical = aaBand(abs(grid.x), 0.018) * step(abs(grid.y), u_params[2] * 1.8);
    float horizontal = aaBand(abs(grid.y), 0.018) * step(abs(grid.x), u_params[2] * 1.8);
    float line = max(vertical, horizontal) * u_params[4] * subject;
    float pulse = 0.75 + 0.25 * sin(u_time * 2.4 + hash(floor(v_uv * density)) * 6.2831);
    vec3 graphic = u_color * (point * (1.2 + u_params[8] * 2.0) + line) * pulse * animPulse * animScan * animExpand;
    color = originalColor + graphic * subject;
  } else if (u_effect == 19) {
    vec2 center = trackedCenter();
    vec2 p = v_uv - center;
    p.x *= aspect;
    float rings = 0.0;
    float spokes = 0.0;
    for (int i = 0; i < 5; i++) {
      float a = float(i) * 1.2566 + sin(u_time * 0.7) * 0.18;
      vec2 dir = vec2(cos(a), sin(a));
      float along = dot(p, dir);
      float crossv = abs(p.x * dir.y - p.y * dir.x);
      spokes = max(spokes, aaBand(crossv, 0.006 * max(u_params[2], 0.5)) * step(abs(along), 0.28));
      rings = max(rings, aaBand(abs(length(p) - (0.06 + float(i) * 0.045)), 0.005 * u_params[1]));
    }
    float subject = trackedMask(v_uv, 0.18);
    float point = gridPoint(v_uv, 34.0, u_params[1] * 0.014, 0.015, 1.5);
    float pulse = 1.0 + sin(u_time * 3.0) * u_params[5];
    color = originalColor + u_color * subject * pulse * animScan * (point + spokes * u_params[3] + rings * 0.45);
  } else if (u_effect == 20) {
    float density = mix(12.0, 50.0, clamp(u_params[0] / 160.0, 0.0, 1.0));
    vec2 p = v_uv * density + vec2(sin(u_time * 0.33), cos(u_time * 0.27)) * u_params[4] * 4.0;
    vec2 tri = fract(vec2(p.x + p.y * 0.5, p.y * 0.866));
    float line = min(min(tri.x, tri.y), abs(tri.x + tri.y - 1.0));
    float wire = aaBand(line, 0.024 * max(u_params[2], 0.5));
    float fill = smoothstep(0.0, 0.5, line) * u_params[3];
    float subject = trackedMask(v_uv, 0.14);
    vec3 meshColor = u_params[5] > 0.5 ? mix(u_color, color, 0.55) : u_color;
    color = originalColor + meshColor * subject * animPulse * (wire * (1.0 + u_params[6]) + fill);
  } else if (u_effect == 21) {
    vec2 px = 1.0 / u_resolution * max(u_params[1], 0.5);
    float edge = length(sampleSource(uv + vec2(px.x, 0.0)).rgb - sampleSource(uv - vec2(px.x, 0.0)).rgb);
    edge += length(sampleSource(uv + vec2(0.0, px.y)).rgb - sampleSource(uv - vec2(0.0, px.y)).rgb);
    float contour = smoothstep(u_params[0], u_params[0] + 0.14, edge);
    vec2 c = trackedCenter();
    float scan = fract((v_uv.y + v_uv.x * 0.25) * 2.0 + u_time * u_params[2]);
    float trace = smoothstep(0.0, u_params[3], scan) * (1.0 - smoothstep(u_params[3], min(1.0, u_params[3] + 0.18), scan));
    float subject = max(trackedMask(v_uv, 0.1), 1.0 - smoothstep(0.24, 0.5, length(v_uv - c)));
    color = originalColor + u_color * subject * contour * (0.8 + trace * 1.8 + u_params[4] * 1.5) * animExpand;
  } else if (u_effect == 22) {
    float density = mix(22.0, 95.0, clamp(u_params[0] / 1200.0, 0.0, 1.0));
    vec2 flow = vec2(sin(u_time * u_params[2]), cos(u_time * u_params[2] * 0.8)) * u_params[4] * 0.08;
    float subject = trackedMask(v_uv - flow, 0.16);
    float point = gridPoint(v_uv + flow, density, u_params[1] * 0.014, u_params[4], 1.1);
    float life = smoothstep(0.0, max(u_params[8], 0.01), fract(hash(floor(v_uv * density)) + u_time / max(u_params[7], 0.1)));
    life *= 1.0 - smoothstep(max(0.0, 1.0 - u_params[9]), 1.0, fract(hash(floor(v_uv * density)) + u_time / max(u_params[7], 0.1)));
    color = originalColor + u_color * point * subject * life * (0.6 + u_params[6]) * animPulse;
  } else if (u_effect == 23) {
    vec2 c = trackedCenter();
    vec2 p = v_uv - c;
    p.x *= aspect;
    float ribbon = 0.0;
    for (int i = 0; i < 5; i++) {
      float t = float(i) / 5.0;
      float wave = sin((p.x + t) * 10.0 + u_time * (1.2 + u_params[6] * 2.0)) * 0.04;
      float y = p.y + wave + (t - 0.5) * 0.14;
      ribbon = max(ribbon, aaBand(abs(y), u_params[2] * 0.006) * smoothstep(0.38, 0.02, abs(p.x)));
    }
    float subject = trackedMask(v_uv, 0.2);
    color = originalColor + u_color * ribbon * (subject + 0.35) * (1.0 + u_params[7] * 2.0) * animScan;
  } else if (u_effect == 24) {
    float density = mix(30.0, 140.0, clamp(u_params[0] / 12000.0, 0.0, 1.0));
    float depth = smoothstep(u_params[5], u_params[6], luma) * u_params[2];
    vec2 cell = fract((v_uv + (depth - 0.5) * u_params[3] * 0.12) * density) - 0.5;
    float point = aaBand(length(cell), u_params[1] * 0.01);
    float subject = trackedMask(v_uv, 0.2);
    color = mix(originalColor, originalColor + u_color * point * subject * (0.8 + depth) * animPulse, 1.0 - u_params[7]);
  }

  float exposure = u_global.x;
  float contrast = u_global.y;
  float vignette = u_global.z;
  float grain = u_global.w;

  color += exposure;
  color = (color - 0.5) * contrast + 0.5;
  float postLuma = dot(color, vec3(0.299, 0.587, 0.114));
  vec2 postPx = 1.0 / u_resolution;
  float postEdge = length(sampleSource(uv + vec2(postPx.x, 0.0)).rgb - sampleSource(uv - vec2(postPx.x, 0.0)).rgb);
  postEdge += length(sampleSource(uv + vec2(0.0, postPx.y)).rgb - sampleSource(uv - vec2(0.0, postPx.y)).rgb);
  vec3 xrayColor = vec3(0.015, 0.09, 0.13) + vec3(0.18, 0.82, 1.0) * pow(1.0 - postLuma, 1.65);
  xrayColor += vec3(0.6, 0.95, 1.0) * smoothstep(0.045, 0.24, postEdge) * 0.95;
  vec3 solarColor = vec3(
    smoothstep(0.08, 0.95, postLuma) * 1.18,
    smoothstep(0.22, 0.84, postLuma) * 0.58,
    smoothstep(0.72, 1.0, postLuma) * 0.25
  );
  vec3 chromeColor = mix(vec3(postLuma * 0.18, postLuma * 0.34, postLuma * 0.42), vec3(0.65, 0.9, 1.0), smoothstep(0.48, 1.0, postLuma));
  chromeColor = mix(chromeColor, vec3(0.02, 0.025, 0.04), smoothstep(0.12, 0.0, postLuma));
  vec3 colorMixTint = mix(vec3(postLuma) * u_color * 1.55, color * (0.72 + u_color * 0.58), 0.5);
  color = mix(color, colorMixTint, u_lookFlags.w * 0.62);
  color = mix(color, solarColor, u_lookFlags.y);
  color = mix(color, chromeColor, u_lookFlags.z);
  color = mix(color, thermal(color), u_flags.z);
  color = mix(color, xrayColor, u_lookFlags.x);
  color = mix(color, 1.0 - color, u_flags.y);
  float bwLuma = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(color, vec3(bwLuma), u_flags.x);
  color += (hash(v_uv * u_time * 180.0) - 0.5) * grain * 0.12;
  float vig = smoothstep(0.95, 0.18, length(v_uv - 0.5));
  color *= mix(1.0, vig, vignette);

  float sourceTransform = (
    u_effect == 2 || u_effect == 3 || u_effect == 4 || u_effect == 5 ||
    u_effect == 6 || u_effect == 7 || u_effect == 8 || u_effect == 9 ||
    u_effect == 10 || u_effect == 11 || u_effect == 12 || u_effect == 13 ||
    u_effect == 14 || u_effect == 15 || u_effect == 16 || u_effect == 17 ||
    u_effect == 18 || u_effect == 19 || u_effect == 20 || u_effect == 21 ||
    u_effect == 22 || u_effect == 23 || u_effect == 24
  ) ? 1.0 : 0.0;

  vec3 blended = color;
  if (sourceTransform < 0.5 && u_common.z > 0.5 && u_common.z < 1.5) {
    blended = 1.0 - (1.0 - originalColor) * (1.0 - color);
  } else if (sourceTransform < 0.5 && u_common.z > 1.5 && u_common.z < 2.5) {
    blended = originalColor + color;
  } else if (sourceTransform < 0.5 && u_common.z > 2.5 && u_common.z < 3.5) {
    blended = originalColor * color;
  } else if (sourceTransform < 0.5 && u_common.z > 3.5) {
    blended = abs(originalColor - color);
  }
  float effectAmount = u_effect == 2 ? 1.0 : (sourceTransform > 0.5 ? max(clamp(u_common.x, 0.0, 1.0), 0.82) : clamp(u_common.x, 0.0, 1.0));
  color = mix(originalColor, blended, effectAmount);
  float originalMix = u_effect == 2 ? 0.0 : (sourceTransform > 0.5 ? clamp(u_common.y, 0.0, 0.18) : clamp(u_common.y, 0.0, 1.0));
  color = mix(color, originalColor, originalMix);
  float finalLuma = dot(color, vec3(0.299, 0.587, 0.114));
  vec3 finalXray = vec3(0.01, 0.08, 0.12) + vec3(0.2, 0.86, 1.0) * pow(1.0 - finalLuma, 1.7);
  finalXray += vec3(0.55, 0.95, 1.0) * smoothstep(0.045, 0.24, postEdge);
  vec3 finalColorMixTint = mix(vec3(finalLuma) * u_color * 1.55, color * (0.72 + u_color * 0.58), 0.5);
  color = mix(color, finalColorMixTint, u_lookFlags.w * 0.62);
  color = mix(color, solarColor, u_lookFlags.y);
  color = mix(color, chromeColor, u_lookFlags.z);
  color = mix(color, thermal(color), u_flags.z);
  color = mix(color, finalXray, u_lookFlags.x);
  color = mix(color, 1.0 - color, u_flags.y);
  finalLuma = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(color, vec3(finalLuma), u_flags.x);

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), base.a);
}
`;

const compileShader = (gl: WebGLRenderingContext, type: number, source: string) => {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Unable to create shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) || 'Unknown shader error';
    gl.deleteShader(shader);
    throw new Error(info);
  }
  return shader;
};

const createProgram = (gl: WebGLRenderingContext) => {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!program) throw new Error('Unable to create WebGL program');
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) || 'Unknown program error';
    gl.deleteProgram(program);
    throw new Error(info);
  }
  return program;
};

const hexToRgb = (hex: string) => {
  const safe = /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#40bfbf';
  const value = parseInt(safe.slice(1), 16);
  return [
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
  ] as const;
};

export const createShaderRenderer = (canvas: HTMLCanvasElement): ShaderRenderer | null => {
  const gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: true,
    desynchronized: true,
    preserveDrawingBuffer: false,
  } as WebGLContextAttributes);
  if (!gl) return null;
  gl.getExtension('OES_standard_derivatives');

  const program = createProgram(gl);
  const texture = gl.createTexture();
  const buffer = gl.createBuffer();
  if (!texture || !buffer) return null;

  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW
  );

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  const positionLocation = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  return {
    canvas,
    gl,
    program,
    texture,
    buffer,
    positionLocation,
    textureLocation: gl.getUniformLocation(program, 'u_texture'),
    resolutionLocation: gl.getUniformLocation(program, 'u_resolution'),
    sourceResolutionLocation: gl.getUniformLocation(program, 'u_sourceResolution'),
    timeLocation: gl.getUniformLocation(program, 'u_time'),
    effectLocation: gl.getUniformLocation(program, 'u_effect'),
    paramsLocation: gl.getUniformLocation(program, 'u_params'),
  globalLocation: gl.getUniformLocation(program, 'u_global'),
  commonLocation: gl.getUniformLocation(program, 'u_common'),
  flagsLocation: gl.getUniformLocation(program, 'u_flags'),
  lookLocation: gl.getUniformLocation(program, 'u_lookFlags'),
    colorLocation: gl.getUniformLocation(program, 'u_color'),
    boxCountLocation: gl.getUniformLocation(program, 'u_boxCount'),
    boxesLocation: gl.getUniformLocation(program, 'u_boxes'),
  };
};

export const disposeShaderRenderer = (renderer: ShaderRenderer | null) => {
  if (!renderer) return;
  const { gl, program, texture, buffer } = renderer;
  gl.deleteTexture(texture);
  gl.deleteBuffer(buffer);
  gl.deleteProgram(program);
};

const getSourceSize = (source: SourceElement) => {
  if (source instanceof HTMLVideoElement) {
    return {
      width: source.videoWidth || source.clientWidth || 1,
      height: source.videoHeight || source.clientHeight || 1,
    };
  }
  return {
    width: source.naturalWidth || source.clientWidth || 1,
    height: source.naturalHeight || source.clientHeight || 1,
  };
};

const paramsToUniform = (effectId: EffectId, params: any) => {
  if (effectId === 'vortex') {
    return [params.ringCount || 12, params.rotationSpeed || 1, params.shapeSides || 6, params.complexity || 0.5, params.expansion || 1.2, 0, 0, 0];
  }
  if (effectId === 'kaleido') {
    return [params.segments || 8, params.radius || 0.8, params.rotation || 0, params.zoom || 1.5, params.mirror ? 1 : 0, 0, 0, 0];
  }
  if (effectId === 'geometry') {
    const shape = params.shape === 'hexagon' ? 1 : params.shape === 'rhombus' ? 2 : 0;
    return [params.gridSize || 25, params.recursive || 2, params.wireframe ? 1 : 0, params.displacement || 9, shape, 0, 0, 0];
  }
  if (effectId === 'line') {
    const shapeType = params.shapeType === 'dot'
      ? 1
      : params.shapeType === 'square'
        ? 2
        : params.shapeType === 'number'
          ? 3
          : params.shapeType === 'alphabet'
            ? 4
            : 0;
    return [shapeType, params.threshold || 62.5, params.dotSize || 7.75, params.dotRandom || 0.5, 0, 0, 0, 0];
  }
  if (effectId === 'pixel') {
    return [params.pixelSize || 33, params.sizeVariance || 0.5, params.posterize || 6, 0, 0, 0, 0, 0];
  }
  if (effectId === 'halftone') {
    return [params.dotSize || 42, params.dotSizeRandom || 0.5, params.angle || 45, 0, 0, 0, 0, 0];
  }
  if (effectId === 'plexus') {
    return [0, params.pointCount || 325, params.linkDistance || 80, params.lineWidth || 2.6, params.pointSize || 5.5, params.jitter || 10, params.pointSizeRandom || 0.5, params.showNumbers ? 1 : 0];
  }
  if (effectId === 'matrix') {
    return [params.density || 225, params.fallSpeed || 7.75, params.fontSize || 23, params.showNumbers ? 1 : 0, 0, 0, 0, 0];
  }
  if (effectId === 'glitch') {
    return [params.density || 45, params.size || 350, params.thickness || 8, params.threshold || 80, 0, 0, 0, 0];
  }
  if (effectId === 'kinetic_avoid') {
    const mode = params.colorMode === 'source' ? 1 : params.colorMode === 'mono' ? 2 : 0;
    return [
      params.density || 42,
      params.blockScale || 0.68,
      params.avoidRadius || 0.14,
      params.repelStrength || 0.85,
      params.driftSpeed || 1.2,
      mode,
      0,
      0,
    ];
  }
  if (effectId === 'motion_trail') {
    return [
      params.trailLength || 0.72,
      params.decay || 0.62,
      params.blur || 0.35,
      params.feedbackScale || 1.018,
      params.rotation || 0.018,
      params.glow || 0.7,
      params.motionReactivity || 0.6,
      params.effectAmount || 0.9,
    ];
  }
  if (effectId === 'rgb_shift') {
    const direction = params.direction === 'vertical' ? 1 : params.direction === 'diagonal' ? 2 : params.direction === 'radial' ? 3 : 0;
    return [
      params.rgbAmount || 0.018,
      direction,
      params.radialAmount || 0.45,
      params.jitter || 0.18,
      params.lensDistortion || 0.22,
      params.motionReactivity || 0.5,
      params.edgeOnly ? 1 : 0,
      params.effectAmount || 0.85,
    ];
  }
  if (effectId === 'neon_edge') {
    return [
      params.edgeThickness || 1.8,
      params.edgeThreshold || 0.2,
      params.glow || 1.1,
      params.trail || 0.28,
      params.growth || 0.25,
      params.backgroundDim || 0.55,
      params.motionReactivity || 0.35,
      0,
    ];
  }
  if (effectId === 'pixel_flow') {
    const direction = params.direction === 'vertical' ? 1 : params.direction === 'radial' ? 2 : 0;
    return [direction, params.threshold || 0.45, params.sortLength || 0.28, 18, params.noise || 0.22, params.speed || 1, params.stretchAmount || 0.4, params.motionReactivity || 0.4];
  }
  if (effectId === 'time_scan') {
    const direction = params.direction === 'vertical' ? 1 : params.direction === 'radial' ? 2 : 0;
    return [params.timeDepth || 0.55, direction, 0.16, params.delay || 0.2, params.repeat || 2, params.wave || 0.35, params.maskFeather || 0.25, params.timeOffset || 0.1];
  }
  if (effectId === 'motion_particles') {
    const mode = params.directionMode === 'push' ? 1 : params.directionMode === 'pull' ? 2 : params.directionMode === 'swirl' ? 3 : 0;
    return [params.particleCount || 650, params.particleSize || 2.4, params.motionStrength || 0.65, params.flowSmoothness || 0.42, params.turbulence || 0.35, params.particleLifetime || 0.7, params.motionThreshold || 0.18, mode];
  }
  if (effectId === 'depth_cloud') {
    return [params.depthStrength || 0.55, params.pointSize || 2.6, params.pointDensity || 0.5, params.zScale || 0.6, params.explosion || 0.18, params.noise || 0.25, params.cameraOrbit || 0.35, params.originalMix || 0.35];
  }
  if (effectId === 'kinetic_plexus') {
    return [params.pointCount || 120, params.pointSize || 3, params.connectionDistance || 0.12, params.maxConnections || 4, params.lineOpacity || 0.58, params.jitter || 0.02, params.trackingSmoothness || 0.82, params.motionReaction || 0.72, params.glow || 0.26, 0];
  }
  if (effectId === 'landmark_constellation') {
    const type = params.landmarkType === 'hands' ? 1 : params.landmarkType === 'pose' ? 2 : params.landmarkType === 'mixed' ? 3 : 0;
    return [type, params.pointSize || 3, params.lineWidth || 1, params.connectionOpacity || 0.72, params.trackingSmoothness || 0.86, params.pulseAmount || 0.36, params.motionReaction || 0.7, params.trailLength || 0.22, 0, 0];
  }
  if (effectId === 'tri_mesh') {
    const meshMode = params.meshMode === 'filled' ? 1 : params.meshMode === 'hybrid' ? 2 : 0;
    const colorSource = params.colorSource === 'source' ? 1 : 0;
    return [params.pointDensity || 75, meshMode, params.lineWidth || 1, params.fillOpacity || 0.14, params.distortion || 0.03, colorSource, params.edgeGlow || 0.22, params.trackingSmoothness || 0.82, 0, 0];
  }
  if (effectId === 'edge_trace') {
    return [params.threshold || 0.34, params.lineThickness || 2, params.traceSpeed || 0.8, params.visibleLength || 0.42, params.glow || 0.42, params.trail || 0.28, params.contourSmoothing || 0.76, params.internalEdges ? 1 : 0, 0, 0];
  }
  if (effectId === 'particle_drift') {
    return [params.particleCount || 420, params.particleSize || 2.5, params.driftSpeed || 0.35, params.noiseScale || 0.8, params.noiseStrength || 0.42, params.stickiness || 0.74, params.motionReaction || 0.58, params.lifetime || 5, params.fadeIn || 0.4, params.fadeOut || 0.8];
  }
  if (effectId === 'ribbon_trails') {
    const source = params.trackingSource === 'hands' ? 1 : params.trackingSource === 'object' ? 2 : params.trackingSource === 'center' ? 3 : 0;
    return [source, params.trailLength || 45, params.lineWidth || 3, params.smoothing || 0.82, params.motionWidthReaction || 0.7, params.fadeOut || 0.86, params.ribbonTwist || 0.18, params.glow || 0.28, 0, 0];
  }
  if (effectId === 'depth_field') {
    return [params.pointCount || 8000, params.pointSize || 1.5, params.depthStrength || 0.56, params.parallax || 0.16, params.cameraDrift || 0.12, params.nearClip || 0.05, params.farClip || 0.95, params.originalMix || 0.78, params.depthSmoothing || 0.7, 0];
  }
  return [0, 0, 0, 0, 0, 0, 0, 0];
};

export interface DetectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ColorModeWeights {
  bw: number;
  xray: number;
  invert: number;
  thermal: number;
  warm: number;
  cool: number;
}

export const renderShaderFrame = (
  renderer: ShaderRenderer,
  source: SourceElement,
  effectId: EffectId,
  effectParams: any,
  globalParams: GlobalParams,
  elapsed: number,
  detectionBoxes: DetectionBox[] = [],
  colorModeWeights?: ColorModeWeights
) => {
  const { gl, canvas, program, texture } = renderer;
  const sourceSize = getSourceSize(source);
  if (sourceSize.width <= 1 || sourceSize.height <= 1) return;

  gl.useProgram(program);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);

  gl.uniform1i(renderer.textureLocation, 0);
  gl.uniform2f(renderer.resolutionLocation, canvas.width, canvas.height);
  gl.uniform2f(renderer.sourceResolutionLocation, sourceSize.width, sourceSize.height);
  gl.uniform1f(renderer.timeLocation, elapsed);
  gl.uniform1i(renderer.effectLocation, EFFECT_INDEX[effectId] ?? 0);
  gl.uniform1fv(renderer.paramsLocation, new Float32Array(paramsToUniform(effectId, effectParams)));
  gl.uniform4f(
    renderer.globalLocation,
    globalParams.exposure,
    globalParams.contrast,
    globalParams.vignette,
    globalParams.grain
  );
  const blendMode = globalParams.blendMode === 'screen'
    ? 1
    : globalParams.blendMode === 'add'
      ? 2
      : globalParams.blendMode === 'multiply'
        ? 3
        : globalParams.blendMode === 'difference'
          ? 4
          : 0;
  gl.uniform4f(
    renderer.commonLocation,
    globalParams.effectEnabled ? globalParams.effectAmount : 0,
    globalParams.originalMix,
    blendMode,
    globalParams.speed
  );
  gl.uniform4f(
    renderer.flagsLocation,
    colorModeWeights?.bw ?? (globalParams.bw ? 1 : 0),
    colorModeWeights?.invert ?? (globalParams.invert ? 1 : 0),
    colorModeWeights?.thermal ?? (globalParams.thermal ? 1 : 0),
    globalParams.animationMode === 'float'
      ? 1
      : globalParams.animationMode === 'pulse'
        ? 2
        : globalParams.animationMode === 'follow_motion'
          ? 3
          : globalParams.animationMode === 'expand'
            ? 4
            : globalParams.animationMode === 'scan'
              ? 5
              : 0
  );
  gl.uniform4f(
    renderer.lookLocation,
    colorModeWeights?.xray ?? (globalParams.xray ? 1 : 0),
    colorModeWeights?.warm ?? (globalParams.dramaticWarm ? 1 : 0),
    colorModeWeights?.cool ?? (globalParams.dramaticCool ? 1 : 0),
    globalParams.colorMix ? 1 : 0
  );
  gl.uniform3fv(renderer.colorLocation, new Float32Array(hexToRgb(globalParams.effectColor)));
  const boxes = new Float32Array(8 * 4);
  const count = Math.min(detectionBoxes.length, 8);
  for (let i = 0; i < count; i++) {
    const box = detectionBoxes[i];
    boxes[i * 4] = box.x;
    boxes[i * 4 + 1] = box.y;
    boxes[i * 4 + 2] = box.width;
    boxes[i * 4 + 3] = box.height;
  }
  gl.uniform1i(renderer.boxCountLocation, count);
  gl.uniform4fv(renderer.boxesLocation, boxes);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
};
