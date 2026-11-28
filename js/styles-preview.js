import * as THREE from 'three';

/* ------------------------------------------------------------------
   10 款圣诞树造型预览
   全部用同一个粒子引擎生成，只是轮廓函数不同 —— 选中的那款可以直接
   搬到正式页面里替换现在的树。
------------------------------------------------------------------ */

const H = 5.0;           // 树高
const R = 1.75;          // 底半径
const TAU = Math.PI * 2;

const rndOf = (seed) => {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/* ---------- 纹理 ---------- */
function glowTex(size = 64, core = '#ffffff', mid = 'rgba(255,255,255,.55)') {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, core);
  gr.addColorStop(0.35, mid);
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function starTex(size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.translate(size / 2, size / 2);
  const glow = g.createRadialGradient(0, 0, 0, 0, 0, size / 2);
  glow.addColorStop(0, 'rgba(255,238,190,.95)');
  glow.addColorStop(0.35, 'rgba(255,206,110,.45)');
  glow.addColorStop(1, 'rgba(255,190,90,0)');
  g.fillStyle = glow;
  g.beginPath(); g.arc(0, 0, size / 2, 0, TAU); g.fill();

  const rr = size * 0.36, ri = rr * 0.42;
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5;
    const rad = i % 2 ? ri : rr;
    g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rad, Math.sin(a) * rad);
  }
  g.closePath();
  const sg = g.createLinearGradient(0, -rr, 0, rr);
  sg.addColorStop(0, '#fffdf1');
  sg.addColorStop(0.5, '#ffdf9b');
  sg.addColorStop(1, '#e2a33c');
  g.fillStyle = sg;
  g.shadowColor = 'rgba(255,200,90,.9)';
  g.shadowBlur = size * 0.14;
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const TEX_GLOW = glowTex(64);
const TEX_STAR = starTex(128);

/* ---------- 场景工具 ---------- */
const matFor = (size, opacity = 1) => new THREE.PointsMaterial({
  size, map: TEX_GLOW, transparent: true, opacity,
  depthWrite: false, blending: THREE.AdditiveBlending,
  vertexColors: true, sizeAttenuation: true,
});

class Builder {
  constructor(seed) {
    this.rand = rndOf(seed);
    this.pos = [];
    this.col = [];
    this.lights = [];
    this.snow = [];
  }
  pt(x, y, z, color, jitter = 0) {
    this.pos.push(x, y, z);
    const c = color instanceof THREE.Color ? color : new THREE.Color(color);
    this.col.push(c.r, c.g, c.b);
    if (jitter) { /* reserved */ }
  }
  light(x, y, z, color, size = 0.13, jit = 0) {
    this.lights.push({ x, y, z, color, size, jit });
  }
  snowAt(x, y, z) { this.snow.push(x, y, z); }
  points(size, opacity) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    return new THREE.Points(g, matFor(size, opacity));
  }
}

const rrange = (r, a, b) => a + r() * (b - a);
const jitterC = (r, c, amt = 0.12) => {
  const col = c instanceof THREE.Color ? c.clone() : new THREE.Color(c);
  col.offsetHSL((r() - 0.5) * amt * 0.3, (r() - 0.5) * amt, (r() - 0.5) * amt * 0.8);
  return col;
};

/* ---------- 公共装饰 ---------- */
function addStar(scene, y = H + 0.35, scale = 1.25, color = '#ffffff') {
  const m = new THREE.SpriteMaterial({ map: TEX_STAR, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color });
  const s = new THREE.Sprite(m);
  s.position.set(0, y, 0);
  s.scale.setScalar(scale);
  scene.add(s);
}

function addGround(scene, color = '#e8b56a', opacity = 0.5, radius = R * 3.2) {
  const m = new THREE.MeshBasicMaterial({ map: TEX_GLOW, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(radius, radius * 0.55), m);
  p.rotation.x = -Math.PI / 2;
  p.position.y = 0.02;
  scene.add(p);
}

function addSnow(b, count = 160, box = 4.2) {
  const r = b.rand;
  for (let i = 0; i < count; i++) {
    b.snow.push(rrange(r, -box, box), rrange(r, 0.2, H + 1.2), rrange(r, -2.2, 2.2));
  }
}

function snowPoints(b, size = 0.045, opacity = 0.75) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.snow, 3));
  const m = new THREE.PointsMaterial({ size, map: TEX_GLOW, color: '#e8f4ff', transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
  return new THREE.Points(g, m);
}

function lightPoints(b, size = 0.13, opacity = 0.95) {
  const g = new THREE.BufferGeometry();
  const pos = [], col = [];
  for (const l of b.lights) {
    pos.push(l.x, l.y, l.z);
    const c = new THREE.Color(l.color);
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return new THREE.Points(g, matFor(size, opacity));
}

/* ---------- 10 款造型 ---------- */

// 01 经典层叠
function styleTiered() {
  const b = new Builder(11);
  const r = b.rand;
  const tiers = 6;
  const greens = ['#2f7350', '#3f8a60', '#57a878', '#7cc596'];
  for (let k = 0; k < tiers; k++) {
    const yb = H * (1 - (k + 1) / tiers) + H * 0.012;
    const ht = H / tiers * 1.34;
    const rt = R * Math.pow((k + 1) / tiers, 0.9);
    const n = 980 + k * 150;
    for (let i = 0; i < n; i++) {
      const u = Math.pow(r(), 0.9);
      const th = r() * TAU;
      const y = yb + ht * u;
      let rad = rt * (0.18 + 0.82 * u);
      rad *= (0.58 + 0.42 * r());
      rad *= 1 + 0.10 * Math.sin(th * 8 + k * 1.7) * u;
      // 枝层下垂
      const y2 = y - 0.16 * u * u * (0.5 + 0.5 * Math.sin(th * 6 + k));
      b.pt(Math.cos(th) * rad, y2, Math.sin(th) * rad, jitterC(r, greens[k % greens.length], 0.18));
    }
    // 枝层内侧补一层暗绿，让层与层之间有厚度
    for (let i = 0; i < 260; i++) {
      const u = r();
      const th = r() * TAU;
      const rad = rt * (0.2 + 0.7 * u) * Math.pow(r(), 1.4);
      b.pt(Math.cos(th) * rad, yb + ht * u, Math.sin(th) * rad, jitterC(r, '#1f4a36', 0.12));
    }
    // 枝层下缘的亮边
    for (let i = 0; i < 90; i++) {
      const th = r() * TAU;
      const rad = rt * rrange(r, 0.9, 1.0);
      b.pt(Math.cos(th) * rad, yb + rrange(r, 0, 0.05), Math.sin(th) * rad, jitterC(r, '#8fd3a6', 0.2));
    }
    // 层间暖灯
    for (let i = 0; i < 14; i++) {
      const th = r() * TAU;
      const rad = rt * rrange(r, 0.7, 1.0);
      b.light(Math.cos(th) * rad, yb + rrange(r, 0.02, 0.16), Math.sin(th) * rad,
        r() < 0.7 ? '#ffd489' : '#ffb066', 0.15);
    }
  }
  addSnow(b);
  for (let i = 0; i < 30; i++) {
    const u = rrange(r, 0.08, 0.95), th = r() * TAU;
    const y = H * u, rad = R * (1 - u) * rrange(r, 0.82, 1.0);
    b.light(Math.cos(th) * rad, y, Math.sin(th) * rad,
      ['#e8523f', '#f2c14a', '#4fae6a', '#5a8fd6', '#f7f0e4'][(r() * 5) | 0], 0.2);
  }
  return { b, bg: '#081018', ground: '#f0b76b', star: 1.3 };
}

// 02 细高雪松
function styleSpire() {
  const b = new Builder(22);
  const r = b.rand;
  for (let i = 0; i < 4200; i++) {
    const u = Math.pow(r(), 0.9);
    const th = r() * TAU;
    const y = H * (0.02 + 0.98 * u);
    let rad = R * 0.78 * Math.pow(1 - u, 1.22);
    rad *= 1 + 0.05 * Math.sin(th * 11);
    b.pt(Math.cos(th) * rad, y, Math.sin(th) * rad,
      jitterC(r, ['#2b5f52', '#3c7f6a', '#5da189', '#8fcbb4'][(r() * 4) | 0], 0.16));
  }
  for (let i = 0; i < 700; i++) {
    const u = Math.pow(r(), 0.85);
    const th = r() * TAU;
    const rad = R * 0.78 * Math.pow(1 - u, 1.22);
    for (let j = 0; j < 4; j++) {
      const k = 1 + rrange(r, -0.06, 0.10);
      b.pt(Math.cos(th + rrange(r, -0.05, 0.05)) * rad * k, H * u + rrange(r, -0.03, 0.03),
        Math.sin(th + rrange(r, -0.05, 0.05)) * rad * k, jitterC(r, '#bfe8d6', 0.12));
    }
  }
  for (let i = 0; i < 24; i++) {
    const u = rrange(r, 0.05, 0.92), th = r() * TAU;
    const rad = R * 0.78 * Math.pow(1 - u, 1.22) * rrange(r, 0.7, 0.98);
    b.light(Math.cos(th) * rad, H * u, Math.sin(th) * rad,
      ['#f2c14a', '#e8523f', '#f7f0e4'][(r() * 3) | 0], 0.18);
  }
  for (let i = 0; i < 60; i++) {
    const u = rrange(r, 0.15, 0.95), th = r() * TAU;
    const rad = R * 0.76 * Math.pow(1 - u, 1.22);
    b.light(Math.cos(th) * rad, H * u, Math.sin(th) * rad, '#cfe9ff', 0.09);
  }
  addSnow(b, 220);
  return { b, bg: '#060d14', ground: '#9fd0e8', star: 1.2 };
}

// 03 圆润胖树
function stylePlump() {
  const b = new Builder(33);
  const r = b.rand;
  for (let i = 0; i < 4400; i++) {
    const u = Math.pow(r(), 0.8);
    const th = r() * TAU;
    const y = H * (0.03 + 0.97 * u);
    let rad = R * 1.12 * Math.pow(1 - u, 0.62);
    rad *= 1 + 0.10 * Math.sin(u * Math.PI * 0.9);
    rad *= 1 + 0.05 * Math.sin(th * 7 + u * 6);
    b.pt(Math.cos(th) * rad, y, Math.sin(th) * rad,
      jitterC(r, ['#3c7f4e', '#4f9a61', '#6fb87c', '#9ad39a'][(r() * 4) | 0], 0.16));
  }
  for (let i = 0; i < 40; i++) {
    const th = r() * TAU, u = rrange(r, 0.2, 0.8);
    const rad = R * 1.1 * Math.pow(1 - u, 0.62);
    b.light(Math.cos(th) * rad, H * u, Math.sin(th) * rad, '#ffd28a', 0.16);
  }
  addSnow(b);
  for (let i = 0; i < 28; i++) {
    const u = rrange(r, 0.06, 0.94), th = r() * TAU;
    const y = H * u, rad = R * 1.05 * Math.pow(1 - u, 0.62) * rrange(r, 0.75, 0.95);
    b.light(Math.cos(th) * rad, y, Math.sin(th) * rad,
      ['#e8523f', '#f2c14a', '#5a8fd6', '#f7f0e4'][(r() * 4) | 0], 0.2);
  }
  return { b, bg: '#0a1014', ground: '#d8b07a', star: 1.35 };
}

// 04 螺旋流光
function styleSpiral() {
  const b = new Builder(44);
  const r = b.rand;
  const turns = 9;
  for (let i = 0; i < 5200; i++) {
    const t = r();
    const th = t * TAU * turns;
    const y = H * (0.04 + 0.94 * t);
    const rad = R * 0.88 * Math.pow(1 - t, 1.02);
    const w = 0.05 + 0.03 * r();
    b.pt(Math.cos(th + w) * rad, y + (r() - 0.5) * 0.05, Math.sin(th + w) * rad,
      jitterC(r, ['#2f6b78', '#4a9fb0', '#7fd8e6', '#d9f6ff'][(r() * 4) | 0], 0.14));
  }
  for (let i = 0; i < 170; i++) {
    const t = i / 170;
    const th = t * TAU * turns;
    const rad = R * 0.9 * Math.pow(1 - t, 1.02);
    b.light(Math.cos(th) * rad, H * (0.04 + 0.94 * t), Math.sin(th) * rad, '#bff4ff', 0.14);
  }
  addSnow(b, 180);
  return { b, bg: '#050b12', ground: '#7fd8e6', star: 1.2 };
}

// 05 双螺旋
function styleDouble() {
  const b = new Builder(55);
  const r = b.rand;
  const turns = 6;
  for (let i = 0; i < 5000; i++) {
    const t = r();
    const side = r() < 0.5 ? 0 : Math.PI;
    const th = t * TAU * turns + side;
    const y = H * (0.04 + 0.93 * t);
    const rad = R * 0.95 * Math.pow(1 - t, 1.08);
    const j = 0.05 * r();
    b.pt(Math.cos(th + j) * rad, y + (r() - 0.5) * 0.08, Math.sin(th + j) * rad,
      jitterC(r, side ? '#8f6bd8' : '#5fa8ff', 0.16));
  }
  for (let i = 0; i < 120; i++) {
    const t = i / 120, side = i % 2 ? 0 : Math.PI;
    const th = t * TAU * turns + side;
    const rad = R * 0.95 * Math.pow(1 - t, 1.08);
    b.light(Math.cos(th) * rad, H * (0.04 + 0.93 * t), Math.sin(th) * rad, '#f2e8ff', 0.12);
  }
  addSnow(b, 160);
  return { b, bg: '#080a16', ground: '#9b8cff', star: 1.2 };
}

// 06 瀑布柳枝
function styleWillow() {
  const b = new Builder(66);
  const r = b.rand;
  // 锥形树冠
  for (let i = 0; i < 2600; i++) {
    const u = Math.pow(r(), 0.9);
    const th = r() * TAU;
    const y = H * (0.02 + 0.98 * u);
    const rad = R * 0.9 * Math.pow(1 - u, 1.05) * (0.5 + 0.5 * r());
    b.pt(Math.cos(th) * rad, y, Math.sin(th) * rad, jitterC(r, '#4f9a6e', 0.16));
  }
  // 下垂的柳枝
  const strands = 70;
  for (let s = 0; s < strands; s++) {
    const th = (s / strands) * TAU + rrange(r, -0.04, 0.04);
    const u0 = rrange(r, 0.25, 0.9);
    const r0 = R * 0.88 * Math.pow(1 - u0, 1.05);
    const len = rrange(r, 0.8, 1.6) * (0.6 + 0.7 * (1 - u0));
    const n = 34;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const y = H * u0 - len * t + rrange(r, -0.02, 0.02);
      const rad = r0 * (1 + 0.16 * t);
      b.pt(Math.cos(th) * rad, y, Math.sin(th) * rad,
        jitterC(r, ['#3f7d5b', '#5fa77c', '#8ccf9c'][(r() * 3) | 0], 0.16));
      if (i % 5 === 2) b.light(Math.cos(th) * rad, y, Math.sin(th) * rad, '#ffd9a0', 0.10);
    }
  }
  addSnow(b, 220);
  return { b, bg: '#07100e', ground: '#cfe6b8', star: 1.2 };
}

// 07 枝干骨架
function styleSkeleton() {
  const b = new Builder(77);
  const r = b.rand;
  const trunkTop = H * 0.98;
  for (let i = 0; i < 800; i++) {
    const y = rrange(r, 0, trunkTop);
    const th = r() * TAU, rad = rrange(r, 0, 0.05);
    b.pt(Math.cos(th) * rad, y, Math.sin(th) * rad, '#c9a37a');
  }
  const whorls = 13;
  for (let k = 0; k < whorls; k++) {
    const u = 0.08 + 0.88 * (k / (whorls - 1));
    const y0 = H * u;
    const rad0 = R * 0.95 * Math.pow(1 - u, 1.02) * rrange(r, 0.85, 1.0);
    const arms = 7;
    for (let a = 0; a < arms; a++) {
      const th = (a / arms) * TAU + k * 0.5;
      const droop = 0.18 + 0.25 * r();
      const n = 26;
      for (let i = 0; i < n; i++) {
        const t = i / n;
        const rad = rad0 * t;
        const y = y0 - droop * t * t;
        b.pt(Math.cos(th) * rad, y, Math.sin(th) * rad, jitterC(r, '#7d6242', 0.1));
        if (r() < 0.35) b.pt(Math.cos(th + 0.12) * rad * rrange(r, .9, 1.05), y + 0.03, Math.sin(th + 0.12) * rad * rrange(r, .9, 1.05), jitterC(r, ['#3f7d4f', '#5fa76a'][(r() * 2) | 0], 0.18));
      }
      b.light(Math.cos(th) * rad0 * 0.98, y0 - droop - 0.04, Math.sin(th) * rad0 * 0.98,
        ['#ffcf7a', '#ff7a62', '#8fd0ff'][(r() * 3) | 0], 0.17);
    }
  }
  addSnow(b, 120);
  return { b, bg: '#0b0d12', ground: '#caa477', star: 1.15 };
}

// 08 几何线框
function styleWire() {
  const b = new Builder(88);
  const r = b.rand;
  const rings = 10;
  for (let k = 0; k < rings; k++) {
    const u = 0.04 + 0.92 * (k / (rings - 1));
    const y = H * u;
    const rad = R * 1.02 * Math.pow(1 - u, 1.0);
    const n = 70;
    for (let i = 0; i < n; i++) {
      const th = (i / n) * TAU;
      b.pt(Math.cos(th) * rad, y, Math.sin(th) * rad, '#9fe8ff');
    }
  }
  const meridians = 18;
  for (let m = 0; m < meridians; m++) {
    const th = (m / meridians) * TAU;
    const n = 60;
    for (let i = 0; i < n; i++) {
      const u = i / n;
      const y = H * (0.02 + 0.96 * u);
      const rad = R * 1.02 * Math.pow(1 - u, 1.0);
      b.pt(Math.cos(th) * rad, y, Math.sin(th) * rad, m % 3 === 0 ? '#ffd9a0' : '#7fc6ff');
    }
  }
  for (let i = 0; i < 40; i++) {
    const u = r(), th = r() * TAU;
    const rad = R * 1.02 * Math.pow(1 - u, 1.0);
    b.light(Math.cos(th) * rad, H * u, Math.sin(th) * rad, '#ffffff', 0.14);
  }
  addSnow(b, 100);
  return { b, bg: '#050a12', ground: '#7fc6ff', star: 1.1 };
}

// 09 千层纸艺
function stylePaper() {
  const b = new Builder(99);
  const r = b.rand;
  const layers = 9;
  for (let k = 0; k < layers; k++) {
    const u = 0.09 + 0.86 * (k / (layers - 1));
    const y0 = H * u;
    const rad = R * 1.06 * Math.pow(1 - u, 1.0);
    const layerH = H * 0.06;
    const n = 420 + k * 40;
    for (let i = 0; i < n; i++) {
      const s = Math.sqrt(r());
      const th = r() * TAU;
      const rr2 = rad * s;
      const y = y0 + (1 - s) * layerH + rrange(r, -0.01, 0.01);
      b.pt(Math.cos(th) * rr2, y, Math.sin(th) * rr2,
        jitterC(r, ['#f7f0de', '#ece0c8', '#ddcdaa'][(r() * 3) | 0], 0.07));
    }
    for (let i = 0; i < 120; i++) {
      const th = r() * TAU;
      b.pt(Math.cos(th) * rad, y0 + rrange(r, -0.01, 0.01), Math.sin(th) * rad, '#d9b87c');
    }
    for (let i = 0; i < 10; i++) {
      const th = r() * TAU;
      b.light(Math.cos(th) * rad * 0.9, y0 + 0.02, Math.sin(th) * rad * 0.9, '#ffcf82', 0.11);
    }
  }
  addSnow(b, 90, 4);
  return { b, bg: '#14100c', ground: '#e8c98e', star: 1.3 };
}

// 10 糖果绒球
function styleFluff() {
  const b = new Builder(101);
  const r = b.rand;
  const palette = ['#ffb7cf', '#ffd9a0', '#b8f2d8', '#c9c2ff', '#ffeaf2'];
  const clusters = 620;
  for (let c = 0; c < clusters; c++) {
    const u = Math.pow(r(), 0.85);
    const th = r() * TAU;
    const y = H * (0.05 + 0.92 * u);
    const rad = R * 1.02 * Math.pow(1 - u, 0.92) * (0.45 + 0.55 * Math.sqrt(r()));
    const cx = Math.cos(th) * rad, cz = Math.sin(th) * rad;
    const col = palette[(r() * palette.length) | 0];
    const n = 18;
    for (let i = 0; i < n; i++) {
      b.pt(cx + (r() - 0.5) * 0.12, y + (r() - 0.5) * 0.12, cz + (r() - 0.5) * 0.12,
        jitterC(r, col, 0.1));
    }
    if (r() < 0.34) b.light(cx, y, cz, palette[(r() * palette.length) | 0], 0.2);
  }
  addSnow(b, 200);
  return { b, bg: '#121222', ground: '#ffd3e6', star: 1.35 };
}

/* ---------- 组装 10 个场景 ---------- */
const STYLES = [
  { id: 1, name: '经典层叠', desc: '多层松枝 · 层层下垂 · 暖黄灯', make: styleTiered },
  { id: 2, name: '细高雪松', desc: '高瘦冷杉 · 雪夜蓝 · 冷白灯', make: styleSpire },
  { id: 3, name: '圆润胖树', desc: '矮胖饱满 · 松绿 · 适合小屏', make: stylePlump },
  { id: 4, name: '螺旋流光', desc: '一条光带盘旋到底 · 冰蓝', make: styleSpiral },
  { id: 5, name: '双螺旋', desc: '两道流光缠绕 · 蓝紫', make: styleDouble },
  { id: 6, name: '瀑布柳枝', desc: '枝条下垂 · 金色垂灯', make: styleWillow },
  { id: 7, name: '枝干骨架', desc: '露出枝干 · 挂彩色灯泡', make: styleSkeleton },
  { id: 8, name: '几何线框', desc: '经纬线构成 · 极简科技感', make: styleWire },
  { id: 9, name: '千层纸艺', desc: '一层层纸片堆叠 · 米白', make: stylePaper },
  { id: 10, name: '糖果绒球', desc: '粉彩绒球 · 梦幻 · 少女感', make: styleFluff },
];

const scenes = STYLES.map((s) => {
  const { b, bg, ground, star } = s.make();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(bg);
  scene.add(b.points(0.085, 0.95));
  scene.add(lightPoints(b));
  if (b.snow.length) scene.add(snowPoints(b));
  addGround(scene, ground, 0.42);
  addStar(scene, H + 0.3, star);
  return scene;
});

/* ---------- 渲染到网格 ---------- */
const stage = document.getElementById('stage');
const gl = document.getElementById('gl');
const cards = document.getElementById('cards');

const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.autoClear = false;

STYLES.forEach((s, i) => {
  const d = document.createElement('div');
  d.className = 'card';
  d.innerHTML = `<div class="idx">0${s.id}</div><div class="txt">${s.name}<small>${s.desc}</small></div>`;
  cards.appendChild(d);
});

const cellEls = [...cards.children];

function layout() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  const dpr = renderer.getPixelRatio();

  const cam = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  const cellRects = cellEls.map((el) => {
    const r = el.getBoundingClientRect(), sr = stage.getBoundingClientRect();
    return { x: r.left - sr.left, y: r.top - sr.top, w: r.width, h: r.height };
  });

  renderer.setScissorTest(true);
  cellRects.forEach((c, i) => {
    const aspect = c.w / c.h;
    cam.aspect = aspect;
    const halfFov = (cam.fov * Math.PI / 180) / 2;
    const distV = (H * 0.62) / Math.tan(halfFov);
    const distH = (R * 1.28) / (Math.tan(halfFov) * aspect);
    const dist = Math.max(distV, distH) * 1.06;
    cam.position.set(0, H * 0.52, dist);
    cam.lookAt(0, H * 0.5, 0);
    cam.updateProjectionMatrix();

    const px = c.x * dpr, py = (h - c.y - c.h) * dpr;
    renderer.setViewport(px, py, c.w * dpr, c.h * dpr);
    renderer.setScissor(px, py, c.w * dpr, c.h * dpr);
    renderer.clear(true, true, true);
    renderer.render(scenes[i], cam);
  });
}

window.addEventListener('resize', () => requestAnimationFrame(layout));
layout();
setTimeout(layout, 300);
