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
  flagsLocation: WebGLUniformLocation | null;
  colorLocation: WebGLUniformLocation | null;
  boxCountLocation: WebGLUniformLocation | null;
  boxesLocation: WebGLUniformLocation | null;
}

const EFFECT_INDEX: Record<EffectId, number> = {
  none: 0,
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

const FRAGMENT_SHADER = `
#extension GL_OES_standard_derivatives : enable
precision highp float;

uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform vec2 u_sourceResolution;
uniform float u_time;
uniform int u_effect;
uniform float u_params[8];
uniform vec4 u_global;
uniform vec4 u_flags;
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

void main() {
  vec2 uv = coverUv(v_uv);
  vec2 effectUv = uv;
  vec2 centered = uv - 0.5;
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
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
  } else if (u_effect == 5) {
    float size = max(u_params[0], 2.0);
    vec2 grid = vec2(size) / u_resolution;
    effectUv = (floor(uv / grid) + 0.5) * grid;
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
  }

  vec4 base = sampleSource(effectUv);
  vec3 color = base.rgb;
  float luma = dot(color, vec3(0.299, 0.587, 0.114));

  if (u_effect == 3) {
    float gridSize = max(u_params[0], 8.0);
    vec2 grid = fract(v_uv * u_resolution / gridSize);
    float line = min(min(grid.x, grid.y), min(1.0 - grid.x, 1.0 - grid.y));
    float wire = aaBand(line, 0.035);
    float pulse = 0.55 + 0.45 * sin(u_time * 2.0 + luma * 8.0);
    color = mix(color * 0.55, u_color * (0.4 + luma) * pulse, wire);
  } else if (u_effect == 4) {
    vec2 px = 1.0 / u_resolution;
    float edge = length(sampleSource(effectUv + vec2(px.x, 0.0)).rgb - sampleSource(effectUv - vec2(px.x, 0.0)).rgb);
    edge += length(sampleSource(effectUv + vec2(0.0, px.y)).rgb - sampleSource(effectUv - vec2(0.0, px.y)).rgb);
    float threshold = u_params[1] / 255.0;
    float stroke = smoothstep(threshold, threshold + 0.2, edge);
    color = mix(color * 0.38, u_color, stroke);
  } else if (u_effect == 6) {
    float dotSize = max(u_params[0], 2.0);
    vec2 cell = fract(v_uv * u_resolution / dotSize) - 0.5;
    float dot = 1.0 - smoothstep(luma * 0.48, luma * 0.48 + 0.05, length(cell));
    color = mix(color * 0.35, u_color, dot);
  } else if (u_effect == 7) {
    float scale = max(u_params[1] * 0.02, 4.0);
    vec2 cell = floor(v_uv * scale);
    vec2 local = fract(v_uv * scale);
    float point = aaBand(length(local - 0.5), 0.055);
    float h = hash(cell);
    float link = step(0.965, hash(vec2(cell.x + floor(u_time), cell.y)));
    color = mix(color * 0.45, u_color * (0.5 + h), max(point, link * 0.55));
  } else if (u_effect == 8) {
    float density = max(u_params[0] * 0.08, 6.0);
    vec2 cell = floor(v_uv * vec2(density, density * 1.6));
    float stream = hash(vec2(cell.x, 1.7));
    float fall = fract(stream + u_time * max(u_params[1], 0.5) * 0.12);
    float trail = smoothstep(0.0, 0.18, 1.0 - abs(fract(v_uv.y * density * 1.6) - fall));
    float glyph = step(0.66, hash(cell + floor(u_time * 12.0)));
    color = mix(color * 0.28, u_color * (0.4 + glyph), trail * (0.35 + glyph * 0.65));
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
    color = mix(color * 0.18, blockColor, rect * (1.0 - avoid * 0.82));
    color += u_color * smoothstep(0.9, 0.0, abs(avoid - 0.36)) * 0.25;
  }

  float exposure = u_global.x;
  float contrast = u_global.y;
  float vignette = u_global.z;
  float grain = u_global.w;

  color += exposure;
  color = (color - 0.5) * contrast + 0.5;
  color = mix(color, vec3(luma), u_flags.x);
  color = mix(color, 1.0 - color, u_flags.y);
  color = mix(color, thermal(color), u_flags.z);
  color += (hash(v_uv * u_time * 180.0) - 0.5) * grain * 0.12;
  float vig = smoothstep(0.95, 0.18, length(v_uv - 0.5));
  color *= mix(1.0, vig, vignette);

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
    antialias: false,
    preserveDrawingBuffer: true,
  });
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
  flagsLocation: gl.getUniformLocation(program, 'u_flags'),
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
    return [params.gridSize || 25, params.recursive || 2, params.wireframe ? 1 : 0, params.displacement || 15, 0, 0, 0, 0];
  }
  if (effectId === 'line') {
    return [0, params.threshold || 62.5, params.dotSize || 7.75, params.dotRandom || 0.5, 0, 0, 0, 0];
  }
  if (effectId === 'pixel') {
    return [params.pixelSize || 33, params.sizeVariance || 0.5, params.posterize || 6, 0, 0, 0, 0, 0];
  }
  if (effectId === 'halftone') {
    return [params.dotSize || 21, params.dotSizeRandom || 0.5, params.angle || 45, 0, 0, 0, 0, 0];
  }
  if (effectId === 'plexus') {
    return [0, params.pointCount || 325, params.linkDistance || 80, params.lineWidth || 2.6, params.pointSize || 5.5, params.jitter || 10, 0, 0];
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
  return [0, 0, 0, 0, 0, 0, 0, 0];
};

export interface DetectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const renderShaderFrame = (
  renderer: ShaderRenderer,
  source: SourceElement,
  effectId: EffectId,
  effectParams: any,
  globalParams: GlobalParams,
  elapsed: number,
  detectionBoxes: DetectionBox[] = []
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
  gl.uniform4f(
    renderer.flagsLocation,
    globalParams.bw ? 1 : 0,
    globalParams.invert || globalParams.xray ? 1 : 0,
    globalParams.thermal ? 1 : 0,
    globalParams.duotone ? 1 : 0
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
