// Shared constants + small helpers (textures, easing) used by the scene modules.
import * as THREE from 'three';

export const TREE = { height: 12, radius: 4.8, baseY: -5.4, tiers: 7 };
export const GROUND_Y = TREE.baseY - 0.35;

export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const damp = (cur, target, lambda, dt) => cur + (target - cur) * (1 - Math.exp(-lambda * dt));

/** Tree silhouette radius at normalized height h (0 bottom .. 1 top), with layered tiers. */
export function treeRadiusAt(h) {
  const s = currentShape();
  const tiers = s.tiers || TREE.tiers;
  const tierBase = s.tierBase ?? 0.74;
  const tierAmp = s.tierAmp ?? 0.34;
  const tierPow = s.tierPow ?? 1.4;
  const tierT = (h * tiers) % 1;
  const tierShape = tierBase + tierAmp * Math.pow(1 - tierT, tierPow);
  let r = TREE.radius * (1 - h) * tierShape;
  if (s.factor) r *= Math.max(0.05, s.factor(h));
  return Math.max(0, r);
}

/* ------------------------------------------------------------------ *
 * 树形（造型）注册表：只改轮廓/密度/配色，不动渲染管线。
 * ------------------------------------------------------------------ */
const TAU = Math.PI * 2;
const angDist = (a, c) => {
  let d = a - c;
  return Math.atan2(Math.sin(d), Math.cos(d));
};
const helixBand = (a, c, w) => Math.abs(angDist(a, c)) < w;
const frac = (x) => x - Math.floor(x);

const CREAM_PALETTE = [
  ['#f6efdd', 0.42, 1.05],
  ['#e8dcc0', 0.30, 0.95],
  ['#d8c8a4', 0.18, 0.90],
  ['#c9a86a', 0.10, 0.85],
];

const CHAMPAGNE_PALETTE = [
  ['#f7e3b0', 0.26, 1.08],
  ['#e8c88e', 0.30, 1.00],
  ['#b98a4a', 0.26, 0.94],
  ['#7a5426', 0.18, 0.88],
];
const CANDY_PALETTE = [
  ['#ffe0ee', 0.26, 1.06],
  ['#ffb0d0', 0.28, 1.00],
  ['#f4739f', 0.26, 0.95],
  ['#b9547c', 0.20, 0.88],
];
const SNOW_PALETTE = [
  ['#eef8ff', 0.20, 1.12],
  ['#cfeaf6', 0.24, 1.02],
  ['#8fc4b4', 0.30, 0.96],
  ['#3f7f68', 0.26, 0.90],
];

export const SHAPES = [
  { id: 'classic', name: '原版', emoji: '🎄' },
  { id: 'tiered', name: '层叠', emoji: '🌲', tiers: 8, tierBase: 0.44, tierAmp: 0.60, tierPow: 1.05, density: 0.35 },
  { id: 'slim', name: '细高', emoji: '🌵', factor: (h) => 0.40 + 0.10 * h },
  { id: 'plump', name: '圆润', emoji: '🔵', factor: (h) => 1.38 * (1 + 0.08 * Math.sin(Math.PI * h)), tiers: 5, tierBase: 0.88, tierAmp: 0.20 },
  { id: 'spire', name: '尖塔', emoji: '🗼', factor: (h) => 0.42 * (1 + 0.60 * (1 - h)), tiers: 5, tierBase: 0.90, tierAmp: 0.14 },
  {
    id: 'spiral', name: '螺旋', emoji: '🌀', density: 8,
    keep: (a, h, rand) => helixBand(a, h * TAU * 7, 0.30) || rand() < 0.10,
    snap: (a, h) => h * TAU * 7 + Math.max(-0.22, Math.min(0.22, angDist(a, h * TAU * 7))),
  },
  {
    id: 'double', name: '双螺旋', emoji: '🧬', density: 11,
    keep: (a, h, rand) => helixBand(a, h * TAU * 6, 0.30) || helixBand(a, h * TAU * 6 + Math.PI, 0.30) || rand() < 0.08,
    snap: (a, h) => {
      const c = h * TAU * 6;
      const d0 = angDist(a, c), d1 = angDist(a, c + Math.PI);
      return Math.abs(d0) <= Math.abs(d1)
        ? c + Math.max(-0.22, Math.min(0.22, d0))
        : c + Math.PI + Math.max(-0.22, Math.min(0.22, d1));
    },
  },
  { id: 'willow', name: '柳枝', emoji: '🌿', factor: (h) => 1.02 + 0.05 * Math.sin(Math.PI * h), tiers: 6, tierBase: 0.80, tierAmp: 0.28, density: 0.5 },
  { id: 'spruce', name: '雪松', emoji: '🌨️', factor: (h) => 0.55 + 0.22 * (1 - h), tiers: 5, tierBase: 0.88, tierAmp: 0.14, palette: SNOW_PALETTE },
  { id: 'champagne', name: '香槟金', emoji: '🥂', factor: (h) => 1.00 + 0.05 * Math.sin(Math.PI * h), tiers: 6, tierBase: 0.82, tierAmp: 0.22, palette: CHAMPAGNE_PALETTE },
  { id: 'candy', name: '糖果粉', emoji: '🍬', factor: (h) => 1.14 * (1 + 0.05 * Math.sin(Math.PI * h)), tiers: 6, tierBase: 0.86, tierAmp: 0.20, palette: CANDY_PALETTE },
];

let shapeIndex = 0;
const BALL_PALETTES = {
  champagne: ['#f6dfae', '#e7c07c', '#c99a52', '#fff6e2', '#8a5f2a', '#d9b06a'],
  candy: ['#ffc2dc', '#ff9ec4', '#e6d4ff', '#bfe8d8', '#fff2c9', '#ffd9e8'],
  spruce: ['#ffffff', '#dff3ff', '#bfe4f2', '#9ed6b8', '#f6d98a', '#e3f4ff'],
};
export function shapeBalls() {
  const p = BALL_PALETTES[currentShape().id];
  return p || null;
}
const GIFT_PALETTES = {
  champagne: ['#c9a35a', '#e6c68b', '#8a5f2a', '#f3e3c0', '#b07f3e'],
  candy: ['#ffc2dc', '#ff9ec4', '#e6d4ff', '#bfe8d8', '#fff2c9'],
  spruce: ['#eaf6ff', '#bfe4f2', '#9ed6b8', '#f6d98a', '#d8eefc'],
};
export function shapeGifts() {
  return GIFT_PALETTES[currentShape().id] || null;
}
export function currentShape() { return SHAPES[shapeIndex] || SHAPES[0]; }
export function shapeIndexAt(id) {
  const i = SHAPES.findIndex((s) => s.id === id);
  return i < 0 ? 0 : i;
}
export function setTreeShape(id) {
  shapeIndex = shapeIndexAt(id);
  return currentShape();
}
export function shapeKeep(a, h, rand) {
  const s = currentShape();
  return s.keep ? s.keep(a, h, rand) : true;
}
export function shapeAngleAt(a, h) {
  const s = currentShape();
  return s.snap ? s.snap(a, h) : a;
}
export function shapePalette() { return currentShape().palette || null; }

/** 装饰密度系数：线条感/骨架类造型少挂彩球，避免把树形糊住。 */
const ORNAMENT_SCALE = {
  classic: 1, tiered: .85, slim: .9, plump: .9, spire: .85, willow: .9,
  spiral: .35, double: .35, spruce: .95, champagne: 1, candy: 1.05,
};
export function shapeOrn() { return ORNAMENT_SCALE[currentShape().id] ?? 1; }

// 启动时读 URL ?shape= 或 localStorage 里保存的选择
try {
  const q = new URLSearchParams(location.search).get('shape');
  const saved = q || localStorage.getItem('xmas_shape');
  if (saved) setTreeShape(saved);
} catch (e) { /* ignore */ }

/** Deterministic PRNG so the tree looks the same on every load. */
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Random point in the "scattered galaxy" cloud around the tree. */
export function scatterPoint(rand, out = new THREE.Vector3(), minR = 6, maxR = 19) {
  const u = rand() * 2 - 1;
  const th = rand() * Math.PI * 2;
  const r = minR + (maxR - minR) * Math.pow(rand(), 0.7);
  const s = Math.sqrt(1 - u * u);
  return out.set(r * s * Math.cos(th), r * u * 0.62 + 1.2, r * s * Math.sin(th));
}

/**
 * Per-item tree<->scatter blend, mirrored in the particle vertex shader so meshes
 * and particles move together. progress: 0 scattered .. 1 tree.
 */
export function blendFactor(seed, progress) {
  const delay = seed * 0.4;
  return smoothstep(delay, delay + 0.6, progress);
}

export function blendPosition(out, tree, scatter, seed, progress, time) {
  const t = blendFactor(seed, progress);
  out.lerpVectors(scatter, tree, t);
  const swirl = (1 - t) * (1.0 + seed * 2.0) * 1.2 + time * 0.04 * (1 - t);
  const c = Math.cos(swirl), s = Math.sin(swirl);
  const x = out.x * c - out.z * s, z = out.x * s + out.z * c;
  const f = (1 - t) * 0.35;
  out.set(
    x + f * Math.sin(time * 0.7 + seed * 31),
    out.y + f * Math.sin(time * 0.9 + seed * 17),
    z + f * Math.cos(time * 0.6 + seed * 23),
  );
  return t;
}

// GLSL version of blendPosition (keep in sync with the JS above).
export const BLEND_GLSL = /* glsl */`
  vec3 blendPos(vec3 treeP, vec3 scatterP, float seed, float progress, float time, out float t) {
    float delay = seed * 0.4;
    t = smoothstep(delay, delay + 0.6, progress);
    vec3 p = mix(scatterP, treeP, t);
    float swirl = (1.0 - t) * (1.0 + seed * 2.0) * 1.2 + time * 0.04 * (1.0 - t);
    float c = cos(swirl), s = sin(swirl);
    p = vec3(p.x * c - p.z * s, p.y, p.x * s + p.z * c);
    float f = (1.0 - t) * 0.35;
    p += f * vec3(sin(time * 0.7 + seed * 31.0), sin(time * 0.9 + seed * 17.0), cos(time * 0.6 + seed * 23.0));
    return p;
  }
`;

function canvasTexture(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeGlowTexture(inner = 'rgba(255,240,200,1)', outer = 'rgba(255,170,60,0)') {
  return canvasTexture(256, (g, s) => {
    const c = s / 2;
    const grd = g.createRadialGradient(c, c, 0, c, c, c);
    grd.addColorStop(0, inner);
    grd.addColorStop(0.18, inner.replace(/[\d.]+\)$/, '0.48)'));
    grd.addColorStop(0.45, inner.replace(/[\d.]+\)$/, '0.12)'));
    grd.addColorStop(1, outer);
    g.fillStyle = grd; g.fillRect(0, 0, s, s);
  });
}

export function makeFlakeTexture() {
  return canvasTexture(128, (g, s) => {
    const c = s / 2;
    const grd = g.createRadialGradient(c, c, 0, c, c, c * 0.82);
    grd.addColorStop(0, 'rgba(255,255,255,0.95)');
    grd.addColorStop(0.32, 'rgba(235,245,255,0.45)');
    grd.addColorStop(0.7, 'rgba(220,235,255,0.08)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 2.6; g.lineCap = 'round';
    g.translate(c, c);
    for (let i = 0; i < 6; i++) {
      g.rotate(Math.PI / 3);
      g.beginPath();
      g.moveTo(0, 0); g.lineTo(0, -c * 0.62);
      g.moveTo(0, -c * 0.34); g.lineTo(-c * 0.14, -c * 0.48);
      g.moveTo(0, -c * 0.34); g.lineTo(c * 0.14, -c * 0.48);
      g.stroke();
    }
  });
}
