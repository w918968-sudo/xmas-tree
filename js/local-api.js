// 本地模式：没有后端，也能用。
// 拦截 /api/* 请求，照片存 IndexedDB，祝福存 IndexedDB，全部只在这台设备的浏览器里。
// 注意：为了让原版代码零改动，这里保持和 Python 后端一样的返回结构。

const DB_NAME = 'xmas-tree-local';
const DB_VER = 1;
const MAX_SIDE = 1280;

let dbPromise = null;
const photoUrls = new Map();

function idb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('wishes')) db.createObjectStore('wishes', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function tx(store, mode, fn) {
  return idb().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let out;
    try { out = fn(s); } catch (e) { reject(e); return; }
    t.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out);
    t.onerror = () => reject(t.error);
  }));
}

function all(store) {
  return idb().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(store, 'readonly');
    const req = t.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  }));
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

async function compress(blob) {
  let bmp;
  try {
    bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  } catch {
    bmp = await createImageBitmap(blob);
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const out = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.84));
  return { blob: out || blob, w, h };
}

function photoOut(rec) {
  if (!photoUrls.has(rec.id)) photoUrls.set(rec.id, URL.createObjectURL(rec.blob));
  return { id: rec.id, url: photoUrls.get(rec.id), w: rec.w, h: rec.h, t: rec.t };
}

async function listPhotos() {
  const rows = await all('photos');
  rows.sort((a, b) => a.t - b.t);
  return rows.map(photoOut);
}

async function addPhoto(file) {
  const { blob, w, h } = await compress(file);
  const rec = { id: uid(), blob, w, h, t: Date.now() };
  await tx('photos', 'readwrite', (s) => s.put(rec));
  return photoOut(rec);
}

async function delPhoto(id) {
  await tx('photos', 'readwrite', (s) => s.delete(id));
  const u = photoUrls.get(id);
  if (u) { URL.revokeObjectURL(u); photoUrls.delete(id); }
}

const WISH_THEMES = ['crimson', 'forest', 'gold', 'ivory', 'plum'];

async function listWishes() {
  const rows = await all('wishes');
  rows.sort((a, b) => a.t - b.t);
  return rows.map((w) => ({ id: w.id, text: w.text, author: w.author, theme: w.theme, t: w.t }));
}

async function addWish(payload) {
  const text = String(payload.text || '').slice(0, 80);
  if (!text) throw new Error('empty');
  const rec = {
    id: uid(),
    text,
    author: String(payload.author || '').slice(0, 16),
    theme: WISH_THEMES.includes(payload.theme) ? payload.theme : 'crimson',
    t: Date.now(),
  };
  await tx('wishes', 'readwrite', (s) => s.put(rec));
  return rec;
}

async function delWish(id) {
  await tx('wishes', 'readwrite', (s) => s.delete(id));
}

function roomFor(slug) {
  const isPublic = !slug || slug === 'public';
  return {
    slug: isPublic ? 'public' : slug,
    title: isPublic ? '我的圣诞树' : '我的圣诞树',
    locked: false,
    authorized: true,
    url: isPublic ? '/' : `/?tree=${encodeURIComponent(slug)}`,
  };
}

async function handle(url, init = {}) {
  const path = url.split('?')[0].replace(/^.*\/api\//, '').replace(/^api\//, '');
  const method = (init.method || 'GET').toUpperCase();

  if (path === 'auth') return json({ error: '本地模式不需要口令' }, 401);

  if (path === 'photos' && method === 'GET') return json({ photos: await listPhotos() });
  if (path === 'photos' && method === 'POST') {
    try {
      const blob = init.body;
      if (!(blob instanceof Blob)) return json({ error: '没有收到图片' }, 400);
      if (!blob.type.startsWith('image/')) return json({ error: '只支持图片' }, 415);
      const photo = await addPhoto(blob);
      return json({ photo }, 201);
    } catch (e) {
      console.warn(e);
      return json({ error: '这张图处理失败，换一张试试' }, 500);
    }
  }
  if (path.startsWith('photos/') && method === 'DELETE') {
    await delPhoto(path.slice(7));
    return json({ ok: true });
  }

  if (path === 'wishes' && method === 'GET') return json({ wishes: await listWishes() });
  if (path === 'wishes' && method === 'POST') {
    try {
      const payload = typeof init.body === 'string' ? JSON.parse(init.body) : (init.body || {});
      return json({ wish: await addWish(payload) }, 201);
    } catch {
      return json({ error: '祝福内容不能为空' }, 400);
    }
  }
  if (path.startsWith('wishes/') && method === 'DELETE') {
    await delWish(path.slice(7));
    return json({ ok: true });
  }

  if (path.startsWith('rooms/') && method === 'GET') {
    return json({ room: roomFor(decodeURIComponent(path.slice(6))) });
  }
  if (path === 'rooms' && method === 'POST') {
    return json({ error: '本地模式只有一个空间，直接把链接发给朋友即可' }, 400);
  }

  return json({ error: 'not found' }, 404);
}

export function installLocalApi() {
  if (!window.XMAS_LOCAL) return;
  if (window.__xmasLocalInstalled) return;
  window.__xmasLocalInstalled = true;

  const origFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (/(^|\/)api\//.test(url)) return handle(url, init);
    return origFetch(input, init);
  };
}

installLocalApi();
