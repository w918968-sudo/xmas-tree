import * as THREE from 'three';

const H = 5.0, R = 1.75, TAU = Math.PI * 2;

const rndOf = (seed) => {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const rr = (r, a, b) => a + r() * (b - a);

/* ---------- 纹理 ---------- */
function glowTex(size = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.3, 'rgba(255,255,255,.7)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const TEX_GLOW = glowTex(64);

function starTex() {
  const s = 128, c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d'); g.translate(s / 2, s / 2);
  const glow = g.createRadialGradient(0, 0, 0, 0, 0, s / 2);
  glow.addColorStop(0, 'rgba(255,238,190,.95)'); glow.addColorStop(.4, 'rgba(255,206,110,.4)');
  glow.addColorStop(1, 'rgba(255,190,90,0)');
  g.fillStyle = glow; g.beginPath(); g.arc(0, 0, s / 2, 0, TAU); g.fill();
  const ro = s * 0.36, ri = ro * 0.42;
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? ri : ro;
    g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rad, Math.sin(a) * rad);
  }
  g.closePath();
  const sg = g.createLinearGradient(0, -ro, 0, ro);
  sg.addColorStop(0, '#fffdf1'); sg.addColorStop(.5, '#ffdf9b'); sg.addColorStop(1, '#e2a33c');
  g.fillStyle = sg; g.shadowColor = 'rgba(255,200,90,.9)'; g.shadowBlur = s * .14; g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const TEX_STAR = starTex();

/* 拍立得：白框 + 冬景照片 */
function postcardTex(seed) {
  const r = rndOf(seed);
  const W = 240, Hh = 300;
  const c = document.createElement('canvas'); c.width = W; c.height = Hh;
  const g = c.getContext('2d');
  g.fillStyle = '#f7f2e6'; g.fillRect(0, 0, W, Hh);
  const px = 18, py = 16, pw = W - px * 2, ph = pw;
  const hues = [[214, 60], [22, 55], [150, 45], [265, 50]];
  const [hue, sat] = hues[seed % hues.length];
  const grd = g.createLinearGradient(0, py, 0, py + ph);
  grd.addColorStop(0, `hsl(${hue}, ${sat}%, 22%)`);
  grd.addColorStop(1, `hsl(${hue}, ${sat}%, 8%)`);
  g.save();
  g.beginPath(); g.rect(px, py, pw, ph); g.clip();
  g.fillStyle = grd; g.fillRect(px, py, pw, ph);
  // 月亮
  g.fillStyle = 'rgba(255,244,214,.9)';
  g.beginPath(); g.arc(px + pw * .3, py + ph * .22, 13, 0, TAU); g.fill();
  // 雪地
  g.fillStyle = '#e8eef5';
  g.beginPath(); g.ellipse(px + pw / 2, py + ph * .84, pw * .62, ph * .2, 0, 0, TAU); g.fill();
  // 树
  g.fillStyle = '#0d2a1e';
  for (let k = 0; k < 3; k++) {
    const w = 52 - k * 12, y = py + ph * .82 - k * 26;
    g.beginPath(); g.moveTo(px + pw / 2, y - 58); g.lineTo(px + pw / 2 - w, y); g.lineTo(px + pw / 2 + w, y); g.closePath(); g.fill();
  }
  g.fillStyle = '#3a2b20'; g.fillRect(px + pw / 2 - 4, py + ph * .82, 8, 16);
  // 雪点
  for (let i = 0; i < 70; i++) {
    g.fillStyle = `rgba(255,255,255,${rr(r, .25, .95)})`;
    g.beginPath(); g.arc(px + r() * pw, py + r() * ph * .8, rr(r, .6, 1.6), 0, TAU); g.fill();
  }
  g.restore();
  g.strokeStyle = 'rgba(180,160,120,.5)'; g.lineWidth = 2; g.strokeRect(px, py, pw, ph);
  // 底部手写线
  g.fillStyle = 'rgba(150,130,100,.65)';
  g.fillRect(px + 10, py + ph + 34, W - px * 2 - 20, 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* ---------- 共用 ---------- */
class Buf {
  constructor(seed) { this.rand = rndOf(seed); this.pos = []; this.col = []; }
  pt(x, y, z, color) {
    this.pos.push(x, y, z);
    const c = color instanceof THREE.Color ? color : new THREE.Color(color);
    this.col.push(c.r, c.g, c.b);
  }
  points(size, opacity = .95) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({
      size, map: TEX_GLOW, transparent: true, opacity, depthWrite: false,
      blending: THREE.AdditiveBlending, vertexColors: true, sizeAttenuation: true,
    }));
  }
}
const jc = (r, hex, amt = .14) => {
  const c = new THREE.Color(hex);
  c.offsetHSL((r() - .5) * amt * .3, (r() - .5) * amt, (r() - .5) * amt * .6);
  return c;
};

function makeScene(style, seed) {
  const b = new Buf(seed);
  const r = b.rand;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#081018');
  let cone = (u) => R * Math.pow(1 - u, 1.0);

  if (style === 'tiered') {
    const tiers = 6;
    for (let k = 0; k < tiers; k++) {
      const yb = H * (1 - (k + 1) / tiers) + H * .012;
      const ht = H / tiers * 1.34;
      const rt = R * Math.pow((k + 1) / tiers, .9);
      for (let i = 0; i < 900 + k * 140; i++) {
        const u = Math.pow(r(), .9), th = r() * TAU;
        let rad = rt * (.18 + .82 * u); rad *= (.58 + .42 * r());
        rad *= 1 + .1 * Math.sin(th * 8 + k * 1.7) * u;
        const y = yb + ht * u - .16 * u * u * (.5 + .5 * Math.sin(th * 6 + k));
        b.pt(Math.cos(th) * rad, y, Math.sin(th) * rad,
          jc(r, ['#3f8a60', '#57a878', '#7cc596'][(r() * 3) | 0], .16));
      }
    }
  } else if (style === 'willow') {
    for (let i = 0; i < 2600; i++) {
      const u = Math.pow(r(), .9), th = r() * TAU;
      const rad = R * .9 * Math.pow(1 - u, 1.05) * (.5 + .5 * r());
      b.pt(Math.cos(th) * rad, H * (.02 + .98 * u), Math.sin(th) * rad, jc(r, '#4f9a6e', .16));
    }
    for (let s = 0; s < 70; s++) {
      const th = (s / 70) * TAU + rr(r, -.04, .04), u0 = rr(r, .25, .9);
      const r0 = R * .88 * Math.pow(1 - u0, 1.05), len = rr(r, .8, 1.6) * (.6 + .7 * (1 - u0));
      for (let i = 0; i < 34; i++) {
        const t = i / 34, y = H * u0 - len * t + rr(r, -.02, .02), rad = r0 * (1 + .16 * t);
        b.pt(Math.cos(th) * rad, y, Math.sin(th) * rad, jc(r, '#5fa77c', .16));
      }
    }
  } else { // paper
    const layers = 9;
    for (let k = 0; k < layers; k++) {
      const u = .09 + .86 * (k / (layers - 1));
      const y0 = H * u, rad = R * 1.06 * Math.pow(1 - u, 1.0), lh = H * .06;
      for (let i = 0; i < 460 + k * 40; i++) {
        const s = Math.sqrt(r()), th = r() * TAU;
        b.pt(Math.cos(th) * rad * s, y0 + (1 - s) * lh + rr(r, -.01, .01),
          Math.sin(th) * rad * s, jc(r, ['#f7f0de', '#ece0c8', '#ddcdaa'][(r() * 3) | 0], .06));
      }
      for (let i = 0; i < 120; i++) {
        const th = r() * TAU;
        b.pt(Math.cos(th) * rad, y0, Math.sin(th) * rad, '#d9b87c');
      }
    }
  }
  scene.add(b.points(.095));

  /* ---- 装饰 ---- */
  const r2 = rndOf(seed + 7);
  // 灯串
  const gar = [];
  for (let i = 0; i < 320; i++) {
    const u = .05 + .9 * (i / 320), th = u * TAU * 6.5;
    const rad = cone(u) * 1.03;
    gar.push(new THREE.Vector3(Math.cos(th) * rad, H * u, Math.sin(th) * rad));
  }
  scene.add(new THREE.Points(new THREE.BufferGeometry().setFromPoints(gar),
    new THREE.PointsMaterial({ size: .1, map: TEX_GLOW, color: '#ffd9a0', transparent: true, opacity: .98, depthWrite: false, blending: THREE.AdditiveBlending })));

  // 彩球
  const ballColors = ['#e8523f', '#f2c14a', '#4fae6a', '#5a8fd6', '#f7f0e4', '#c05fd0'];
  for (let i = 0; i < 9; i++) {
    const u = rr(r2, .08, .8), th = r2() * TAU, rad = cone(u) * 1.05;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: TEX_GLOW, color: ballColors[(r2() * ballColors.length) | 0],
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    sp.position.set(Math.cos(th) * rad, H * u, Math.sin(th) * rad);
    sp.scale.setScalar(rr(r2, .32, .46));
    scene.add(sp);
  }

  // 拍立得
  for (let i = 0; i < 5; i++) {
    const u = rr(r2, .2, .72), th = r2() * TAU, rad = cone(u) * 1.16;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: postcardTex(i + 1), transparent: true, depthWrite: false,
    }));
    sp.position.set(Math.cos(th) * rad, H * u, Math.sin(th) * rad);
    sp.scale.set(.62, .78, 1);
    scene.add(sp);
  }

  // 树底礼盒
  const giftColors = ['#b8322a', '#2f7a4e', '#2f5fa8', '#d8a72e'];
  for (let i = 0; i < 8; i++) {
    const th = (i / 8) * TAU + rr(r2, -.2, .2), rad = rr(r2, 1.05, 1.85);
    const s = rr(r2, .3, .48);
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(s, s * .8, s),
      new THREE.MeshBasicMaterial({ color: giftColors[i % giftColors.length] }));
    box.position.y = s * .4;
    g.add(box);
    const rib = new THREE.Mesh(new THREE.BoxGeometry(s * .12, s * .82, s * 1.01),
      new THREE.MeshBasicMaterial({ color: '#e8c46a' }));
    rib.position.y = s * .4; g.add(rib);
    const rib2 = new THREE.Mesh(new THREE.BoxGeometry(s * 1.01, s * .82, s * .12),
      new THREE.MeshBasicMaterial({ color: '#e8c46a' }));
    rib2.position.y = s * .4; g.add(rib2);
    g.position.set(Math.cos(th) * rad, 0, Math.sin(th) * rad);
    g.rotation.y = r2() * TAU;
    scene.add(g);
  }

  // 星星 / 地面 / 雪
  const star = new THREE.Sprite(new THREE.SpriteMaterial({
    map: TEX_STAR, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  star.position.set(0, H + .3, 0); star.scale.setScalar(1.3); scene.add(star);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(R * 3.4, R * 1.9),
    new THREE.MeshBasicMaterial({ map: TEX_GLOW, color: '#e8b56a', transparent: true, opacity: .42, depthWrite: false, blending: THREE.AdditiveBlending }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = .02; scene.add(ground);

  const snowPos = [];
  for (let i = 0; i < 220; i++) snowPos.push(rr(r2, -4.2, 4.2), rr(r2, .2, H + 1.2), rr(r2, -2.2, 2.2));
  scene.add(new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(snowPos, 3)),
    new THREE.PointsMaterial({ size: .05, map: TEX_GLOW, color: '#e8f4ff', transparent: true, opacity: .8, depthWrite: false, blending: THREE.AdditiveBlending })));

  return scene;
}

const CARDS = [
  { style: 'tiered', name: '01 经典层叠 + 装饰', desc: '彩球挂枝层、灯串绕树干、拍立得插在枝间' },
  { style: 'willow', name: '06 瀑布柳枝 + 装饰', desc: '灯串沿着垂枝落下、照片挂在枝条末端' },
  { style: 'paper', name: '09 千层纸艺 + 装饰', desc: '装饰少而精：金色灯点 + 少量彩球' },
];

const scenes = CARDS.map((c, i) => makeScene(c.style, 100 + i));

const stage = document.getElementById('stage');
const gl = document.getElementById('gl');
const cards = document.getElementById('cards');
const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.autoClear = false;

CARDS.forEach((c) => {
  const d = document.createElement('div');
  d.className = 'card';
  d.innerHTML = `<div class="txt">${c.name}<small>${c.desc}</small></div>`;
  cards.appendChild(d);
});

function layout() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  const dpr = renderer.getPixelRatio();
  const cam = new THREE.PerspectiveCamera(34, 1, .1, 100);
  const sr = stage.getBoundingClientRect();

  cards.childNodes.forEach((el, i) => {
    const r = el.getBoundingClientRect();
    const cw = r.width, ch = r.height;
    const aspect = cw / ch;
    cam.aspect = aspect;
    const halfFov = (cam.fov * Math.PI / 180) / 2;
    const distV = (H * .64) / Math.tan(halfFov);
    const distH = (R * 1.35) / (Math.tan(halfFov) * aspect);
    const dist = Math.max(distV, distH) * 1.05;
    cam.position.set(0, H * .52, dist);
    cam.lookAt(0, H * .5, 0);
    cam.updateProjectionMatrix();

    const x = (r.left - sr.left) * dpr, y = (h - (r.top - sr.top) - ch) * dpr;
    renderer.setViewport(x, y, cw * dpr, ch * dpr);
    renderer.setScissor(x, y, cw * dpr, ch * dpr);
    renderer.setScissorTest(true);
    renderer.clear(true, true, true);
    renderer.render(scenes[i], cam);
  });
}

window.addEventListener('resize', () => requestAnimationFrame(layout));
layout();
setTimeout(layout, 250);
