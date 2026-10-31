// New-tab add-ons: widgets and wallpapers downloaded from the Pigeon Web store
// (store/index.json in the GitHub repo) and installed under userData/addons.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { net } = require('electron');

const STORE_URL = (process.env.PIGEON_STORE_URL || 'https://raw.githubusercontent.com/cyansupport/pigeon-web/main/store/')
  .replace(/\/?$/, '/');
const KINDS = new Set(['widgets', 'wallpapers']);
const ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
const STORE_FILE = /^(widgets|wallpapers)\/[a-z0-9/-]+\.(html|jpg|jpeg|png|webp)$/;
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const MAX_DOWNLOAD = 25 * 1024 * 1024;

let root = '';
let storeCache = null;
let storeCacheAt = 0;

function init(userData) { root = path.join(userData, 'addons'); }

function check(kind, id) {
  if (!KINDS.has(kind) || !ID.test(String(id))) throw new Error('invalid');
}

const dirOf = (kind, id) => path.join(root, kind, id);

function readManifest(kind, id) {
  try { return JSON.parse(fs.readFileSync(path.join(dirOf(kind, id), 'manifest.json'), 'utf8')); } catch { return null; }
}

function installed(kind) {
  const dir = path.join(root, kind);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((id) => ID.test(id)).map((id) => readManifest(kind, id)).filter(Boolean)
    .sort((a, b) => a.installedAt - b.installedAt);
}

async function fetchStore(force = false) {
  if (!force && storeCache && Date.now() - storeCacheAt < 10 * 60e3) return storeCache;
  const res = await net.fetch(STORE_URL + 'index.json?t=' + Date.now(), { cache: 'no-store' });
  if (!res.ok) throw new Error('network');
  const index = await res.json();
  for (const w of index.wallpapers || []) if (w.thumb && STORE_FILE.test(w.thumb)) w.thumbUrl = STORE_URL + w.thumb;
  storeCache = index;
  storeCacheAt = Date.now();
  return index;
}

// Downloads one store item, verifies its size and SHA-256, then installs it.
async function install(kind, id, onProgress = () => {}) {
  check(kind, id);
  const index = await fetchStore();
  const item = (index[kind] || []).find((x) => x.id === id);
  if (!item) throw new Error('invalid');
  if (!STORE_FILE.test(item.file) || item.file.includes('..')) throw new Error('invalid');
  if (!(item.size > 0 && item.size <= MAX_DOWNLOAD)) throw new Error('invalid');

  const res = await net.fetch(STORE_URL + item.file, { cache: 'no-store' });
  if (!res.ok) throw new Error('network');
  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.length;
    if (received > item.size) throw new Error('damaged');
    chunks.push(Buffer.from(value));
    onProgress(Math.round((received / item.size) * 100));
  }
  const buf = Buffer.concat(chunks);
  const sha = crypto.createHash('sha256').update(buf).digest('hex');
  if (buf.length !== item.size || sha !== item.sha256) throw new Error('damaged');

  const dir = dirOf(kind, id);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const file = kind === 'widgets' ? 'widget.html' : 'image' + path.extname(item.file);
  fs.writeFileSync(path.join(dir, file), buf);
  const manifest = {
    id, kind, file, name: item.name, desc: item.desc || null, icon: item.icon || null, w: item.w || 1,
    version: item.version || null, size: item.size, installedAt: Date.now()
  };
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest));
  return manifest;
}

function uninstall(kind, id) {
  check(kind, id);
  fs.rmSync(dirOf(kind, id), { recursive: true, force: true });
}

// Copies a user-chosen image in as the "custom" wallpaper.
function installCustomWallpaper(src) {
  const ext = path.extname(src).toLowerCase();
  if (!IMAGE_EXT.has(ext)) throw new Error('badImage');
  const size = fs.statSync(src).size;
  if (size > MAX_DOWNLOAD) throw new Error('tooBig');
  const dir = dirOf('wallpapers', 'custom');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const file = 'image' + ext;
  fs.copyFileSync(src, path.join(dir, file));
  const manifest = { id: 'custom', kind: 'wallpapers', file, custom: true, name: null, size, installedAt: Date.now() };
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest));
  return manifest;
}

// Resolves pigeon://addons/<kind>/<id>/<file> to a file on disk (or null).
function resolveUrlPath(pathname) {
  const [kind, id, file, ...rest] = decodeURIComponent(pathname).split('/').filter(Boolean);
  if (rest.length || !KINDS.has(kind) || !ID.test(id || '') || !file) return null;
  const m = readManifest(kind, id);
  if (!m || m.file !== file) return null;
  const full = path.join(dirOf(kind, id), file);
  return full.startsWith(root + path.sep) && fs.existsSync(full) ? full : null;
}

module.exports = { init, fetchStore, install, uninstall, installed, installCustomWallpaper, resolveUrlPath, readManifest, STORE_URL };
