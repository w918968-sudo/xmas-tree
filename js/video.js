// 出片：背景音乐 / 录制模式 / WebCodecs 一键导出 MP4（1080×1920）
import { Muxer, ArrayBufferTarget } from '../vendor/mp4-muxer.mjs';

const $ = (id) => document.getElementById(id);
const api = () => window.__xmasVideo || null;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const easeInOut = (x) => (x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

/* ---------------- 背景音乐 ---------------- */
let audio = null;
let audioUrl = null;
let musicBuffer = null;   // 解码后的音频，用于混入 MP4
let musicName = '';
let decodeCtx = null;

function getDecodeCtx() {
  if (!decodeCtx) decodeCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (decodeCtx.state === 'suspended') decodeCtx.resume().catch(() => {});
  return decodeCtx;
}

async function decodeMusic(file) {
  try {
    const buf = await file.arrayBuffer();
    const ctx = getDecodeCtx();
    const decoded = await ctx.decodeAudioData(buf);
    musicBuffer = decoded;
    return decoded;
  } catch (e) {
    console.warn('音频解码失败，将只导出无声视频', e);
    musicBuffer = null;
    return null;
  }
}

function initMusic() {
  const file = $('file-music');
  $('btn-music').addEventListener('click', () => file.click());
  $('file-music').addEventListener('change', async () => {
    const f = file.files && file.files[0];
    if (!f) return;
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = URL.createObjectURL(f);
    if (audio) audio.pause();
    audio = new Audio(audioUrl);
    audio.loop = true;
    audio.volume = 0.8;
    audio.play().catch(() => {});
    musicName = f.name.replace(/\.[^.]+$/, '').slice(0, 18);
    $('music-name').textContent = musicName + ' · 解码中…';
    $('btn-music-toggle').hidden = false;
    $('btn-music-toggle').textContent = '⏸ 暂停音乐';
    const decoded = await decodeMusic(f);
    $('music-name').textContent = decoded
      ? `${musicName} · ${decoded.duration.toFixed(0)}s`
      : `${musicName} · 无法解码`;
    file.value = '';
  });
  $('btn-music-toggle').addEventListener('click', () => {
    if (!audio) return;
    if (audio.paused) { audio.play().catch(() => {}); $('btn-music-toggle').textContent = '⏸ 暂停音乐'; }
    else { audio.pause(); $('btn-music-toggle').textContent = '▶️ 继续播放'; }
  });
}

function setDuration(sec) {
  DUR = sec;
  const sub = $('rec-sub');
  if (sub) sub.textContent = `${sec} 秒 · 自动运镜`;
  const mp4 = $('mp4-sub');
  if (mp4) mp4.textContent = `1080×1920 · ${sec}s · 30fps`;
  document.querySelectorAll('.dur-chip').forEach((b) => {
    b.classList.toggle('on', Number(b.dataset.dur) === sec);
  });
}

function initDuration() {
  document.querySelectorAll('.dur-chip').forEach((b) => {
    b.addEventListener('click', () => setDuration(Number(b.dataset.dur)));
  });
  setDuration(DUR);
}

/* ---------------- 面板 ---------------- */
function initPanel() {
  const pop = $('video-pop');
  const open = (v) => {
    pop.classList.toggle('on', v);
    $('shape-pop')?.classList.remove('on');
    if (v) pop.removeAttribute('aria-hidden'); else pop.setAttribute('aria-hidden', 'true');
  };
  $('btn-video').addEventListener('click', (e) => { e.stopPropagation(); open(!pop.classList.contains('on')); });
  $('video-close').addEventListener('click', () => open(false));
  document.addEventListener('click', (e) => {
    if (!pop.classList.contains('on')) return;
    if (pop.contains(e.target) || e.target.closest('#btn-video')) return;
    open(false);
  });
  return { close: () => open(false) };
}

/* ---------------- 录制模式 ---------------- */
let recTimer = null;
let recCountTimer = null;

function startRecording(panel) {
  const a = api();
  if (!a) return;
  panel.close();
  a.setTarget(0);
  document.body.classList.add('recording');
  const overlay = $('rec-overlay');
  overlay.hidden = false;
  let n = 3;
  $('rec-count').textContent = n;
  $('rec-count').classList.remove('live');
  $('rec-tip').textContent = '准备中…';
  if (a.controls) { a.controls.autoRotate = true; a.controls.autoRotateSpeed = -0.55; }
  recCountTimer = setInterval(() => {
    n -= 1;
    if (n > 0) {
      $('rec-count').textContent = n;
      $('rec-count').classList.remove('live');
    } else if (n === 0) {
      $('rec-count').textContent = '●';
      $('rec-count').classList.add('live');
      $('rec-tip').textContent = `开始录制 · ${DUR} 秒后自动结束`;
      a.setTarget(1);
      clearInterval(recCountTimer);
    }
  }, 1000);
  let left = DUR;
  recTimer = setInterval(() => {
    left -= 1;
    if (left >= 0) $('rec-tip').textContent = `屏幕录制中 · 还剩 ${left} 秒`;
  }, 1000);
  setTimeout(() => stopRecording(), (DUR + 3) * 1000);
}

function stopRecording() {
  const a = api();
  clearInterval(recTimer); clearInterval(recCountTimer);
  recTimer = null; recCountTimer = null;
  document.body.classList.remove('recording');
  const overlay = $('rec-overlay');
  if (overlay) overlay.hidden = true;
  if (a && a.controls) { a.controls.autoRotate = false; }
}

/* ---------------- MP4 导出 ---------------- */
const VW = 1080, VH = 1920, FPS = 30;
let DUR = 12;
let exporting = false;

async function pickAvcConfig() {
  const tries = [
    { codec: 'avc1.640028', width: VW, height: VH, bitrate: 9e6, framerate: FPS },
    { codec: 'avc1.4d0028', width: VW, height: VH, bitrate: 8e6, framerate: FPS },
    { codec: 'avc1.42E01E', width: VW, height: VH, bitrate: 6e6, framerate: FPS },
  ];
  for (const c of tries) {
    try {
      const r = await VideoEncoder.isConfigSupported(c);
      if (r && r.supported) return c;
    } catch (e) { /* ignore */ }
  }
  return null;
}

function drawOverlayText(ctx, t) {
  const a = clamp01((t - 0.4) / 1.1);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(255,190,110,.55)';
  ctx.shadowBlur = 34;
  ctx.fillStyle = '#f6dcab';
  ctx.font = `${Math.round(VH * 0.050)}px "Great Vibes", Georgia, serif`;
  ctx.fillText('Merry Christmas', VW / 2, VH * 0.902);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = a * 0.72;
  ctx.fillStyle = 'rgba(255,241,220,.9)';
  ctx.font = `500 ${Math.round(VH * 0.017)}px "Microsoft YaHei", "PingFang SC", sans-serif`;
  ctx.fillText('2026 · 圣诞快乐', VW / 2, VH * 0.938);
  ctx.restore();
}

async function canEncodeAac() {
  if (!('AudioEncoder' in window)) return false;
  try {
    const r = await AudioEncoder.isConfigSupported({ codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 2, bitrate: 128000 });
    return !!r.supported;
  } catch (e) { return false; }
}

async function renderMusic(seconds) {
  const sr = 48000;
  const octx = new OfflineAudioContext(2, Math.round(sr * seconds), sr);
  const src = octx.createBufferSource();
  src.buffer = musicBuffer;
  src.loop = true;
  const gain = octx.createGain();
  gain.gain.setValueAtTime(0.85, 0);
  gain.gain.setValueAtTime(0.85, Math.max(0, seconds - 0.9));
  gain.gain.linearRampToValueAtTime(0, seconds);
  src.connect(gain).connect(octx.destination);
  src.start(0);
  return octx.startRendering();
}

async function exportMp4(panel) {
  if (exporting) return;
  if (!('VideoEncoder' in window)) {
    alert('这个浏览器还不支持一键导出（需要 Chrome / Edge / 新版 Safari）。\n可以先用「录制模式」+ 系统录屏。');
    return;
  }
  const a = api();
  if (!a) return;
  panel.close();
  const cfg = await pickAvcConfig();
  if (!cfg) { alert('当前设备不支持 H.264 编码，请改用「录制模式」。'); return; }

  exporting = true;
  window.__xmasExporting = true;
  const overlay = $('export-overlay');
  overlay.hidden = false;
  $('export-fill').style.width = '0%';

  const { renderer, composer, camera, tree, environment, gallery, wishes, bloom, state } = a;
  const oldW = renderer.domElement.width, oldH = renderer.domElement.height;
  const oldFov = camera.fov, oldAspect = camera.aspect;
  const bgWas = document.body.className;
  document.body.classList.add('exporting');

  renderer.setPixelRatio(1);
  renderer.setSize(VW, VH, false);
  composer.setSize(VW, VH);
  camera.aspect = VW / VH; camera.fov = 52; camera.updateProjectionMatrix();
  camera.position.set(0, 1.15, 23.2); camera.lookAt(0, 1.05, 0);

  const c2 = document.createElement('canvas');
  c2.width = VW; c2.height = VH;
  const ctx2 = c2.getContext('2d');

  const hasAudio = !!musicBuffer && await canEncodeAac();
  const muxConfig = {
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: VW, height: VH },
    fastStart: 'in-memory',
  };
  if (hasAudio) muxConfig.audio = { codec: 'aac', numberOfChannels: 2, sampleRate: 48000 };

  const muxer = new Muxer(muxConfig);
  let encErr = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => { try { muxer.addVideoChunk(chunk, meta); } catch (e) { encErr = e; } },
    error: (e) => { encErr = e; },
  });
  encoder.configure(cfg);

  // 先把背景音乐编码成 AAC 音轨（12 秒、48kHz、立体声，末尾淡出）
  if (hasAudio) {
    $('export-note').textContent = '正在混入背景音乐…';
    try {
      const rendered = await renderMusic(DUR);
      const audioEnc = new AudioEncoder({
        output: (chunk, meta) => { try { muxer.addAudioChunk(chunk, meta); } catch (e) { encErr = e; } },
        error: (e) => { encErr = e; },
      });
      audioEnc.configure({ codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 2, bitrate: 128000 });
      const L = rendered.getChannelData(0), R = rendered.numberOfChannels > 1 ? rendered.getChannelData(1) : L;
      const FR = 1024;
      for (let off = 0; off < rendered.length; off += FR) {
        const n = Math.min(FR, rendered.length - off);
        const planar = new Float32Array(n * 2);
        planar.set(L.subarray(off, off + n), 0);
        planar.set(R.subarray(off, off + n), n);
        const ad = new AudioData({
          format: 'f32-planar', sampleRate: 48000, numberOfFrames: n, numberOfChannels: 2,
          timestamp: Math.round((off / 48000) * 1e6), data: planar,
        });
        audioEnc.encode(ad);
        ad.close();
      }
      await audioEnc.flush();
      audioEnc.close();
    } catch (e) {
      console.warn('音轨编码失败，改为无声视频', e);
    }
    $('export-note').textContent = '请不要关闭页面';
  }

  const total = DUR * FPS;
  try {
    for (let i = 0; i < total; i++) {
      const t = i / FPS;
      // 0–2.4s：散开 -> 聚合；之后保持
      const p = t < 2.4 ? easeInOut(t / 2.4) : 1;
      state.progress = p; state.target = 1;
      tree.group.rotation.y = 0.10 * t;
      camera.position.set(0, 1.15, 23.2 - 2.2 * p);
      camera.lookAt(0, 1.05, 0);
      tree.update(t, p, 1);
      environment.update(t, p);
      gallery.update(t, p, 1 / FPS, camera);
      wishes.update(t, p, 1 / FPS, camera);
      bloom.strength = 0.56 + (1 - p) * 0.08;
      composer.render();
      ctx2.clearRect(0, 0, VW, VH);
      ctx2.drawImage(renderer.domElement, 0, 0, VW, VH);
      drawOverlayText(ctx2, t);
      const frame = new VideoFrame(c2, { timestamp: Math.round(i * 1e6 / FPS), duration: Math.round(1e6 / FPS) });
      encoder.encode(frame, { keyFrame: i % 60 === 0 });
      frame.close();
      if (encoder.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 0));
      if (i % 6 === 0) $('export-fill').style.width = `${Math.round((i / total) * 92)}%`;
      if (encErr) throw encErr;
    }
    await encoder.flush();
    muxer.finalize();
    const blob = new Blob([muxer.target.buffer], { type: 'video/mp4' });
    window.__lastMp4Blob = blob;
    $('export-fill').style.width = '100%';
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `xmas-tree-${Date.now()}.mp4`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) {
    console.error(e);
    alert('导出失败：' + (e?.message || e) + '\n可以改用「录制模式」。');
  } finally {
    try { encoder.close(); } catch (e) {}
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    renderer.setSize(oldW, oldH, false);
    composer.setSize(oldW, oldH);
    camera.aspect = oldAspect; camera.fov = oldFov; camera.updateProjectionMatrix();
    document.body.className = bgWas;
    overlay.hidden = true;
    exporting = false;
    window.__xmasExporting = false;
  }
}

/* ---------------- 初始化 ---------------- */
function boot() {
  const panel = initPanel();
  initMusic();
  initDuration();
  $('btn-rec').addEventListener('click', () => startRecording(panel));
  $('btn-mp4').addEventListener('click', () => exportMp4(panel));
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
