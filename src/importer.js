// Reads bookmarks, history and passwords from other browsers on this PC,
// and parses exported files (passwords CSV, bookmarks HTML).
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { DatabaseSync } = require('node:sqlite');

const IS_MAC = process.platform === 'darwin';
const LOCAL = process.env.LOCALAPPDATA || '';
const ROAMING = process.env.APPDATA || '';
const MAC = path.join(os.homedir(), 'Library', 'Application Support');
// `keychain` is the macOS Keychain item each browser stores its password key in.
const CHROMIUM = IS_MAC ? [
  { name: 'Google Chrome', dir: path.join(MAC, 'Google', 'Chrome'), keychain: 'Chrome Safe Storage' },
  { name: 'Microsoft Edge', dir: path.join(MAC, 'Microsoft Edge'), keychain: 'Microsoft Edge Safe Storage' },
  { name: 'Brave', dir: path.join(MAC, 'BraveSoftware', 'Brave-Browser'), keychain: 'Brave Safe Storage' },
  { name: 'Vivaldi', dir: path.join(MAC, 'Vivaldi'), keychain: 'Vivaldi Safe Storage' },
  { name: 'Opera', dir: path.join(MAC, 'com.operasoftware.Opera'), flat: true, keychain: 'Opera Safe Storage' },
  { name: 'Opera GX', dir: path.join(MAC, 'com.operasoftware.OperaGX'), flat: true, keychain: 'Opera Safe Storage' }
] : [
  { name: 'Google Chrome', dir: path.join(LOCAL, 'Google', 'Chrome', 'User Data') },
  { name: 'Microsoft Edge', dir: path.join(LOCAL, 'Microsoft', 'Edge', 'User Data') },
  { name: 'Brave', dir: path.join(LOCAL, 'BraveSoftware', 'Brave-Browser', 'User Data') },
  { name: 'Vivaldi', dir: path.join(LOCAL, 'Vivaldi', 'User Data') },
  { name: 'Opera', dir: path.join(ROAMING, 'Opera Software', 'Opera Stable'), flat: true },
  { name: 'Opera GX', dir: path.join(ROAMING, 'Opera Software', 'Opera GX Stable'), flat: true }
];
const FIREFOX_DIR = IS_MAC ? path.join(MAC, 'Firefox', 'Profiles') : path.join(ROAMING, 'Mozilla', 'Firefox', 'Profiles');

const readJson = (file) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } };

function detectSources() {
  const out = [];
  for (const b of CHROMIUM) {
    const state = readJson(path.join(b.dir, 'Local State'));
    if (!state) continue;
    if (b.flat) {
      out.push({ id: b.name, label: b.name, kind: 'chromium', root: b.dir, profile: b.dir, keychain: b.keychain });
      continue;
    }
    const cache = state.profile?.info_cache || {};
    const ids = Object.keys(cache).length ? Object.keys(cache) : ['Default'];
    for (const p of ids) {
      const dir = path.join(b.dir, p);
      if (!fs.existsSync(dir)) continue;
      const label = ids.length > 1 ? `${b.name} — ${cache[p]?.name || p}` : b.name;
      out.push({ id: `${b.name}|${p}`, label, kind: 'chromium', root: b.dir, profile: dir, keychain: b.keychain });
    }
  }
  if (fs.existsSync(FIREFOX_DIR)) {
    for (const p of fs.readdirSync(FIREFOX_DIR)) {
      const dir = path.join(FIREFOX_DIR, p);
      if (fs.existsSync(path.join(dir, 'places.sqlite'))) {
        out.push({ id: `Firefox|${p}`, label: `Firefox — ${p.replace(/^[^.]+\./, '')}`, kind: 'firefox', profile: dir });
      }
    }
  }
  return out;
}

// Browsers keep their databases locked while running, so read a copy.
function withDb(file, fn) {
  if (!fs.existsSync(file)) return null;
  const tmp = path.join(os.tmpdir(), `pigeon-import-${crypto.randomUUID()}.db`);
  const copies = [tmp];
  fs.copyFileSync(file, tmp);
  for (const ext of ['-wal', '-shm']) {
    if (fs.existsSync(file + ext)) { fs.copyFileSync(file + ext, tmp + ext); copies.push(tmp + ext); }
  }
  const db = new DatabaseSync(tmp);
  try { return fn(db); } finally {
    db.close();
    for (const f of copies) fs.rmSync(f, { force: true });
  }
}

const isWeb = (url) => /^https?:\/\//i.test(url || '');

// ---------- Chromium ----------
function chromiumBookmarks(src) {
  const json = readJson(path.join(src.profile, 'Bookmarks'));
  const out = [];
  const walk = (node) => {
    if (!node) return;
    if (node.type === 'url' && isWeb(node.url)) out.push({ url: node.url, title: node.name || node.url });
    (node.children || []).forEach(walk);
  };
  Object.values(json?.roots || {}).forEach(walk);
  return out;
}

function chromiumHistory(src) {
  return withDb(path.join(src.profile, 'History'), (db) => db.prepare(
    `SELECT url, title, (last_visit_time / 1000 - 11644473600000) AS time FROM urls
     WHERE hidden = 0 AND last_visit_time > 0 ORDER BY last_visit_time DESC LIMIT 3000`
  ).all()) || [];
}

function dpapiUnprotect(buf) {
  const script = 'Add-Type -AssemblyName System.Security;' +
    `$b=[Convert]::FromBase64String('${buf.toString('base64')}');` +
    "[Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Unprotect($b,$null,'CurrentUser'))";
  return new Promise((resolve, reject) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true },
      (err, stdout) => (err ? reject(err) : resolve(Buffer.from(stdout.trim(), 'base64'))));
  });
}

// macOS: the browser keeps a random password in the Keychain (the user gets a system
// prompt to allow access); Chromium derives the AES-128 key from it with PBKDF2.
function macKeychainKey(service) {
  return new Promise((resolve, reject) => {
    execFile('security', ['find-generic-password', '-w', '-s', service], (err, stdout) => {
      if (err) return reject(err);
      resolve(crypto.pbkdf2Sync(stdout.trim(), 'saltysalt', 1003, 16, 'sha1'));
    });
  });
}

// Windows stores v10 values as AES-256-GCM (nonce + data + tag); macOS as AES-128-CBC with a fixed IV.
function decryptValue(v, key, mac) {
  if (mac) {
    const d = crypto.createDecipheriv('aes-128-cbc', key, Buffer.alloc(16, 0x20));
    return Buffer.concat([d.update(v.subarray(3)), d.final()]).toString('utf8');
  }
  const d = crypto.createDecipheriv('aes-256-gcm', key, v.subarray(3, 15));
  d.setAuthTag(v.subarray(v.length - 16));
  return Buffer.concat([d.update(v.subarray(15, v.length - 16)), d.final()]).toString('utf8');
}

async function chromiumPasswords(src) {
  const files = ['Login Data', 'Login Data For Account'].map((f) => path.join(src.profile, f));
  const rows = files.flatMap((f) => withDb(f, (db) => db.prepare(
    'SELECT origin_url AS url, username_value AS username, password_value AS value FROM logins WHERE blacklisted_by_user = 0'
  ).all()) || []);
  if (!rows.length) return { passwords: [], skipped: 0 };
  const mac = !!src.keychain;
  let key = null;
  if (mac) {
    try { key = await macKeychainKey(src.keychain); } catch { key = null; }
  } else {
    const encKey = readJson(path.join(src.root, 'Local State'))?.os_crypt?.encrypted_key;
    if (encKey && process.platform === 'win32') {
      try { key = await dpapiUnprotect(Buffer.from(encKey, 'base64').subarray(5)); } catch { key = null; }
    }
  }
  const passwords = [];
  let skipped = 0;
  for (const r of rows) {
    const v = Buffer.from(r.value || []);
    const prefix = v.subarray(0, 3).toString();
    if (!key || (prefix !== 'v10' && prefix !== 'v11') || v.length < (mac ? 19 : 31)) { if (v.length) skipped++; continue; }
    try {
      const password = decryptValue(v, key, mac);
      if (isWeb(r.url) && password) passwords.push({ url: r.url, username: r.username || '', password });
    } catch { skipped++; }
  }
  return { passwords, skipped };
}

// ---------- Firefox ----------
function firefoxBookmarks(src) {
  return withDb(path.join(src.profile, 'places.sqlite'), (db) => db.prepare(
    `SELECT p.url AS url, COALESCE(b.title, p.title, p.url) AS title FROM moz_bookmarks b
     JOIN moz_places p ON p.id = b.fk WHERE b.type = 1 AND p.url LIKE 'http%'`
  ).all()) || [];
}

function firefoxHistory(src) {
  return withDb(path.join(src.profile, 'places.sqlite'), (db) => db.prepare(
    `SELECT url, title, (last_visit_date / 1000) AS time FROM moz_places
     WHERE last_visit_date IS NOT NULL AND hidden = 0 AND url LIKE 'http%'
     ORDER BY last_visit_date DESC LIMIT 3000`
  ).all()) || [];
}

async function readSource(src, want) {
  const ff = src.kind === 'firefox';
  const out = { bookmarks: [], history: [], passwords: [], skippedPasswords: 0, passwordsUnsupported: false };
  if (want.bookmarks) out.bookmarks = ff ? firefoxBookmarks(src) : chromiumBookmarks(src);
  if (want.history) out.history = (ff ? firefoxHistory(src) : chromiumHistory(src)).filter((h) => isWeb(h.url));
  if (want.passwords) {
    if (ff) out.passwordsUnsupported = true;
    else Object.assign(out, await chromiumPasswords(src).then((r) => ({ passwords: r.passwords, skippedPasswords: r.skipped })));
  }
  return out;
}

// ---------- exported files ----------
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function passwordsFromCsv(text) {
  const rows = parseCsv(text.replace(/^﻿/, ''));
  const header = (rows.shift() || []).map((h) => h.trim().toLowerCase());
  const col = (...names) => header.findIndex((h) => names.includes(h));
  const iUrl = col('url', 'origin', 'login_uri', 'website', 'web site', 'hostname');
  const iUser = col('username', 'login_username', 'user', 'login', 'email');
  const iPass = col('password', 'login_password');
  if (iUrl < 0 || iPass < 0) throw new Error('errCsv'); // translation key, shown by the UI
  return rows
    .map((r) => ({ url: (r[iUrl] || '').trim(), username: iUser >= 0 ? r[iUser] || '' : '', password: r[iPass] || '' }))
    .filter((p) => isWeb(p.url) && p.password);
}

function bookmarksFromHtml(html) {
  const decode = (s) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
  const out = [];
  for (const m of html.matchAll(/<A\s[^>]*HREF="([^"]+)"[^>]*>([\s\S]*?)<\/A>/gi)) {
    const url = decode(m[1]);
    if (isWeb(url)) out.push({ url, title: decode(m[2]) || url });
  }
  return out;
}

module.exports = { detectSources, readSource, passwordsFromCsv, bookmarksFromHtml, decryptValue };
