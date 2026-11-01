const {
  app, BrowserWindow, ipcMain, session, protocol, net, Menu, clipboard, shell, dialog, nativeTheme, screen, safeStorage
} = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const importer = require('./importer');
const i18n = require('./pages/i18n');
const addons = require('./addons');
const { pathToFileURL } = require('url');
const blocklist = require('./blocklist');
const { DiscordPresence } = require('./discord');

protocol.registerSchemesAsPrivileged([
  { scheme: 'pigeon', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

const PAGES = path.join(__dirname, 'pages');
const ENGINES = {
  google: { name: 'Google', url: 'https://www.google.com/search?q=' },
  duckduckgo: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' },
  bing: { name: 'Bing', url: 'https://www.bing.com/search?q=' },
  brave: { name: 'Brave Search', url: 'https://search.brave.com/search?q=' },
  ecosia: { name: 'Ecosia', url: 'https://www.ecosia.org/search?q=' }
};

// ---------- persistent store ----------
const DEFAULTS = {
  bookmarks: [],
  history: [],
  shortcuts: [],
  newtab: { widgets: [], wallpaper: null, dim: 0.35, positions: {} },
  widgetConfig: {},
  settings: {
    searchEngine: 'google', blockTrackers: true, showBookmarksBar: true,
    discordRpc: false, discordShowSite: false, gooseMode: false, autoUpdate: true, language: 'auto', showDiscordButton: true
  },
  session: null,
  bounds: null,
  maximized: false
};
let data;
const storeFile = () => path.join(app.getPath('userData'), 'pigeon-data.json');

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(storeFile(), 'utf8'));
    data = { ...structuredClone(DEFAULTS), ...raw };
    data.settings = { ...DEFAULTS.settings, ...raw.settings };
    data.newtab = { ...DEFAULTS.newtab, ...raw.newtab };
  } catch {
    data = structuredClone(DEFAULTS);
  }
}
let saveTimer;
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 400); }
function saveNow() {
  clearTimeout(saveTimer);
  try { fs.writeFileSync(storeFile(), JSON.stringify(data)); } catch (e) { console.error('save failed', e); }
}

const brandName = () => (data.settings.gooseMode ? 'Goose Web' : 'Pigeon Web');
const appLang = () => i18n.resolve(data.settings.language, app.getLocale());
const tr = () => i18n.make(appLang());
const searchUrl = (q) => (ENGINES[data.settings.searchEngine] || ENGINES.google).url + encodeURIComponent(q);

// ---------- window ----------
let win;
function send(channel, ...args) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, ...args);
}

function overlayColors() {
  return nativeTheme.shouldUseDarkColors
    ? { color: '#14161c', symbolColor: '#e6e8ef' }
    : { color: '#dfe3ec', symbolColor: '#1d2030' };
}

function validBounds(b) {
  if (!b) return null;
  const visible = screen.getAllDisplays().some(({ workArea: w }) =>
    b.x < w.x + w.width - 50 && b.x + b.width > w.x + 50 && b.y >= w.y - 10 && b.y < w.y + w.height - 50);
  return visible ? b : { width: b.width, height: b.height };
}

function createWindow() {
  const isMac = process.platform === 'darwin';
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    ...validBounds(data.bounds),
    minWidth: 520,
    minHeight: 360,
    show: false,
    title: 'Pigeon Web',
    backgroundColor: overlayColors().color,
    titleBarStyle: 'hidden',
    titleBarOverlay: isMac ? undefined : { ...overlayColors(), height: 40 },
    trafficLightPosition: { x: 14, y: 13 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: true
    }
  });
  if (data.maximized) win.maximize();
  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  win.webContents.on('before-input-event', onInput);
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-attach-webview', (_e, prefs) => {
    delete prefs.preloadURL;
    prefs.preload = path.join(__dirname, 'internal-preload.js');
    prefs.nodeIntegration = false;
    prefs.contextIsolation = true;
    prefs.sandbox = true;
  });

  const saveBounds = () => {
    if (!win.isMaximized() && !win.isMinimized() && !win.isFullScreen()) data.bounds = win.getBounds();
    data.maximized = win.isMaximized();
    save();
  };
  win.on('resize', saveBounds);
  win.on('move', saveBounds);
  win.on('maximize', saveBounds);
  win.on('unmaximize', saveBounds);
  win.on('enter-full-screen', () => send('fullscreen', true));
  win.on('leave-full-screen', () => send('fullscreen', false));
  win.on('app-command', (_e, cmd) => {
    if (cmd === 'browser-backward') send('shortcut', 'back');
    if (cmd === 'browser-forward') send('shortcut', 'forward');
  });
  win.on('closed', () => { win = null; });
}

nativeTheme.on('updated', () => {
  if (win && process.platform !== 'darwin') {
    win.setTitleBarOverlay(overlayColors());
    win.setBackgroundColor(overlayColors().color);
  }
});

// ---------- keyboard shortcuts (work even when a page has focus) ----------
function shortcutFor(input) {
  if (input.type !== 'keyDown') return null;
  const ctrl = input.control || input.meta;
  const { shift, alt } = input;
  const k = input.key.length === 1 ? input.key.toLowerCase() : input.key;
  // macOS conventions; ⌘H stays the system "Hide" and ⌘Q/⌘M are handled by the app menu.
  if (process.platform === 'darwin' && input.meta) {
    if (alt && input.code === 'KeyI') return 'devtools';
    if (input.control && input.code === 'KeyF') return 'fullscreen';
    if (!alt && !shift) {
      if (k === '[') return 'back';
      if (k === ']') return 'forward';
      if (k === 'y') return 'history';
      if (k === 'h' || k === 'q' || k === 'm') return null;
    }
  }
  if (ctrl && !alt) {
    if (k === 't') return shift ? 'reopen-tab' : 'new-tab';
    if (k === 'w' || k === 'F4') return 'close-tab';
    if (k === 'Tab') return shift ? 'prev-tab' : 'next-tab';
    if (k === 'PageDown') return 'next-tab';
    if (k === 'PageUp') return 'prev-tab';
    if (k === 'l') return 'focus-address';
    if (k === 'r' || k === 'F5') return shift || k === 'F5' ? 'hard-reload' : 'reload';
    if (k === 'f') return 'find';
    if (k === 'd') return 'bookmark';
    if (k === 'h') return 'history';
    if (k === 'j') return 'downloads';
    if (k === 'b' && shift) return 'toggle-bookmarks-bar';
    if (k === 'o' && shift) return 'bookmarks';
    if (k === 'i' && shift) return 'devtools';
    if (k === 'p') return 'print';
    if (k === 'u') return 'view-source';
    if (k === '=' || k === '+') return 'zoom-in';
    if (k === '-' || k === '_') return 'zoom-out';
    if (k === '0') return 'zoom-reset';
    if (/^[1-9]$/.test(k)) return 'tab-' + k;
  }
  if (alt && !ctrl) {
    if (k === 'ArrowLeft') return 'back';
    if (k === 'ArrowRight') return 'forward';
    if (k === 'Home') return 'home';
    if (k === 'd') return 'focus-address';
  }
  if (!ctrl && !alt) {
    if (k === 'F5') return 'reload';
    if (k === 'F6') return 'focus-address';
    if (k === 'F11') return 'fullscreen';
    if (k === 'F12') return 'devtools';
  }
  return null;
}

function onInput(event, input) {
  const s = shortcutFor(input);
  if (!s) return;
  event.preventDefault();
  if (s === 'fullscreen') return win && win.setFullScreen(!win.isFullScreen());
  send('shortcut', s);
}

// ---------- page context menu ----------
function canNav(wc, dir) {
  const h = wc.navigationHistory;
  if (h) return dir < 0 ? h.canGoBack() : h.canGoForward();
  return dir < 0 ? wc.canGoBack() : wc.canGoForward();
}

function showContextMenu(wc, p) {
  const t = tr();
  const items = [];
  const openTab = (url) => send('open-tab', { url, background: true });
  const sep = () => { if (items.length && items[items.length - 1].type !== 'separator') items.push({ type: 'separator' }); };

  if (p.isEditable && p.misspelledWord) {
    for (const s of p.dictionarySuggestions.slice(0, 5)) items.push({ label: s, click: () => wc.replaceMisspelling(s) });
    if (!p.dictionarySuggestions.length) items.push({ label: t('noSpelling'), enabled: false });
    items.push({ label: t('addToDictionary'), click: () => wc.session.addWordToSpellCheckerDictionary(p.misspelledWord) });
    sep();
  }
  if (p.linkURL) {
    items.push(
      { label: t('openLinkNewTab'), click: () => openTab(p.linkURL) },
      { label: t('copyLink'), click: () => clipboard.writeText(p.linkURL) }
    );
    sep();
  }
  if (p.mediaType === 'image' && p.srcURL) {
    items.push(
      { label: t('openImageNewTab'), click: () => openTab(p.srcURL) },
      { label: t('saveImage'), click: () => wc.downloadURL(p.srcURL) },
      { label: t('copyImage'), click: () => wc.copyImageAt(p.x, p.y) },
      { label: t('copyImageAddress'), click: () => clipboard.writeText(p.srcURL) }
    );
    sep();
  }
  if (p.isEditable) {
    const f = p.editFlags;
    items.push(
      { label: t('undo'), enabled: f.canUndo, click: () => wc.undo() },
      { label: t('redo'), enabled: f.canRedo, click: () => wc.redo() },
      { type: 'separator' },
      { label: t('cut'), enabled: f.canCut, click: () => wc.cut() },
      { label: t('copy'), enabled: f.canCopy, click: () => wc.copy() },
      { label: t('paste'), enabled: f.canPaste, click: () => wc.paste() },
      { label: t('selectAll'), enabled: f.canSelectAll, click: () => wc.selectAll() }
    );
    sep();
  } else if (p.selectionText.trim()) {
    const sel = p.selectionText.trim();
    const short = sel.length > 24 ? sel.slice(0, 24) + '…' : sel;
    const engine = (ENGINES[data.settings.searchEngine] || ENGINES.google).name;
    items.push(
      { label: t('copy'), click: () => wc.copy() },
      { label: t('searchFor', { engine, text: short }), click: () => send('open-tab', { url: searchUrl(sel) }) }
    );
    sep();
  }
  if (!p.linkURL && !p.isEditable && !p.selectionText.trim() && p.mediaType === 'none') {
    items.push(
      { label: t('back'), enabled: canNav(wc, -1), click: () => send('shortcut', 'back') },
      { label: t('forward'), enabled: canNav(wc, 1), click: () => send('shortcut', 'forward') },
      { label: t('reload'), click: () => wc.reload() },
      { type: 'separator' },
      { label: t('print'), click: () => wc.print() },
      { label: t('viewSource'), click: () => send('open-tab', { url: 'view-source:' + wc.getURL() }) }
    );
    sep();
  }
  items.push({ label: t('inspect'), click: () => wc.inspectElement(p.x, p.y) });
  Menu.buildFromTemplate(items).popup({ window: win });
}

app.on('web-contents-created', (_e, contents) => {
  if (contents.getType() !== 'webview') return;
  contents.setWindowOpenHandler(({ url, disposition }) => {
    if (url && url !== 'about:blank') send('open-tab', { url, background: disposition === 'background-tab' });
    return { action: 'deny' };
  });
  contents.on('before-input-event', onInput);
  contents.on('context-menu', (_ev, params) => showContextMenu(contents, params));
});

// ---------- session: tracker blocking, permissions, downloads ----------
// Permissions we ask the user about; each has a perm_<name> translation.
const ASKABLE = new Set(['media', 'geolocation', 'notifications', 'midi', 'midiSysex', 'clipboard-read',
  'display-capture', 'idle-detection', 'storage-access', 'top-level-storage-access']);
const AUTO_ALLOW = new Set(['fullscreen', 'clipboard-sanitized-write', 'pointerLock', 'keyboardLock']);
const permissionMemory = new Map();
const knownDownloads = new Set();
const activeDownloads = new Map();

function uniquePath(dir, name) {
  const ext = path.extname(name);
  const base = path.basename(name, ext) || 'download';
  let file = path.join(dir, base + ext);
  for (let i = 1; fs.existsSync(file); i++) file = path.join(dir, `${base} (${i})${ext}`);
  return file;
}

function setupSession() {
  const ses = session.defaultSession;

  ses.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (d, cb) => {
    if (data.settings.blockTrackers && d.resourceType !== 'mainFrame') {
      try {
        if (blocklist.isTracker(new URL(d.url).hostname)) {
          if (d.webContentsId) send('blocked', d.webContentsId);
          return cb({ cancel: true });
        }
      } catch { /* malformed url: let it through */ }
    }
    cb({});
  });

  ses.setPermissionRequestHandler(async (wc, permission, callback, details) => {
    if (AUTO_ALLOW.has(permission)) return callback(true);
    if (!ASKABLE.has(permission) || !win) return callback(false);
    let origin;
    try { origin = new URL(details.requestingUrl || wc.getURL()).origin; } catch { return callback(false); }
    const key = origin + '|' + permission;
    if (permissionMemory.has(key)) return callback(permissionMemory.get(key));
    const t = tr();
    const { response, checkboxChecked } = await dialog.showMessageBox(win, {
      type: 'question',
      buttons: [t('allow'), t('block')],
      defaultId: 1,
      cancelId: 1,
      title: t('permTitle'),
      message: t('permAsk', { host: new URL(origin).host, what: t('perm_' + permission) }),
      checkboxLabel: t('permRemember', { name: brandName() }),
      checkboxChecked: true
    });
    const allowed = response === 0;
    if (checkboxChecked) permissionMemory.set(key, allowed);
    callback(allowed);
  });

  let nextDl = 1;
  ses.on('will-download', (_e, item) => {
    const id = nextDl++;
    item.setSavePath(uniquePath(app.getPath('downloads'), item.getFilename()));
    knownDownloads.add(item.getSavePath());
    activeDownloads.set(id, item);
    const info = (state = item.getState()) => ({
      id,
      filename: path.basename(item.getSavePath()),
      path: item.getSavePath(),
      url: item.getURL(),
      received: item.getReceivedBytes(),
      total: item.getTotalBytes(),
      paused: item.isPaused(),
      state,
      started: item.getStartTime() * 1000
    });
    send('download', info());
    item.on('updated', () => send('download', info()));
    item.once('done', (_ev, state) => {
      activeDownloads.delete(id);
      send('download', info(state));
    });
  });
}

// ---------- history & bookmarks ----------
function addHistory({ url, title, favicon }) {
  if (!/^https?:/i.test(url)) return;
  const head = data.history[0];
  if (head && head.url === url && Date.now() - head.time < 30 * 60e3) {
    head.time = Date.now();
    if (title) head.title = title;
    if (favicon) head.favicon = favicon;
  } else {
    data.history.unshift({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      url, title: title || url, favicon: favicon || null, time: Date.now()
    });
    if (data.history.length > 5000) data.history.length = 5000;
  }
  save();
}

function touchHistory({ url, title, favicon }) {
  const h = data.history.slice(0, 50).find((x) => x.url === url);
  if (!h) return;
  if (title) h.title = title;
  if (favicon) h.favicon = favicon;
  for (const b of data.bookmarks) if (b.url === url && favicon && !b.favicon) b.favicon = favicon;
  save();
}

function queryHistory(q = '', limit = 300) {
  q = String(q).toLowerCase();
  const out = [];
  for (const h of data.history) {
    if (!q || h.url.toLowerCase().includes(q) || (h.title || '').toLowerCase().includes(q)) {
      out.push(h);
      if (out.length >= limit) break;
    }
  }
  return out;
}

function suggest(q) {
  q = String(q).toLowerCase().trim();
  if (!q) return [];
  const counts = new Map();
  const latest = new Map();
  for (const h of data.history) {
    counts.set(h.url, (counts.get(h.url) || 0) + 1);
    if (!latest.has(h.url)) latest.set(h.url, h);
  }
  const found = new Map();
  const consider = (item, bonus) => {
    const hay = (item.url + ' ' + (item.title || '')).toLowerCase();
    if (!hay.includes(q)) return;
    const bare = item.url.replace(/^https?:\/\/(www\.)?/i, '').toLowerCase();
    const score = (counts.get(item.url) || 0) + bonus + (bare.startsWith(q) ? 50 : 0);
    const prev = found.get(item.url);
    if (!prev || prev.score < score) {
      found.set(item.url, {
        url: item.url, title: item.title, score, bookmark: bonus > 0,
        favicon: item.favicon || latest.get(item.url)?.favicon || null
      });
    }
  };
  data.bookmarks.forEach((b) => consider(b, 30));
  latest.forEach((h) => consider(h, 0));
  return [...found.values()].sort((a, b) => b.score - a.score).slice(0, 6);
}

// ---------- saved passwords (encrypted with the OS keystore) ----------
let passwords = [];
const passwordFile = () => path.join(app.getPath('userData'), 'pigeon-passwords.bin');
const hostnameOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };

async function loadPasswords() {
  try {
    const { result, shouldReEncrypt } = await safeStorage.decryptStringAsync(fs.readFileSync(passwordFile()));
    passwords = JSON.parse(result);
    if (shouldReEncrypt) await savePasswords();
  } catch {
    passwords = [];
  }
}

async function savePasswords() {
  if (!(await safeStorage.isAsyncEncryptionAvailable())) throw new Error('Password encryption is not available on this system');
  fs.writeFileSync(passwordFile(), await safeStorage.encryptStringAsync(JSON.stringify(passwords)));
}

async function addPasswords(list) {
  let count = 0;
  for (const p of list) {
    let origin;
    try { origin = new URL(p.url).origin; } catch { continue; }
    if (!/^https?:/.test(origin)) continue;
    const existing = passwords.find((x) => x.origin === origin && x.username === p.username);
    if (existing) {
      if (existing.password !== p.password) { existing.password = p.password; count++; }
      continue;
    }
    passwords.push({ id: crypto.randomUUID(), origin, username: p.username || '', password: p.password, created: Date.now() });
    count++;
  }
  if (count) await savePasswords();
  return count;
}

// ---------- importing from other browsers ----------
function mergeBookmarks(list) {
  const known = new Set(data.bookmarks.map((b) => b.url));
  let n = 0;
  for (const b of list) {
    if (known.has(b.url)) continue;
    known.add(b.url);
    data.bookmarks.push({ url: b.url, title: b.title || b.url, favicon: null, added: Date.now() });
    n++;
  }
  return n;
}

function mergeHistory(list) {
  const known = new Set(data.history.map((h) => h.url + '|' + Math.round(h.time / 1000)));
  const added = [];
  for (const h of list) {
    const time = Math.round(Number(h.time));
    if (!time || known.has(h.url + '|' + Math.round(time / 1000))) continue;
    added.push({ id: crypto.randomUUID(), url: h.url, title: h.title || h.url, favicon: null, time });
  }
  data.history = data.history.concat(added).sort((a, b) => b.time - a.time).slice(0, 5000);
  return added.length;
}

async function importFromBrowser(id, want = {}) {
  const src = importer.detectSources().find((s) => s.id === id);
  if (!src) return { error: 'errBrowserNotFound' };
  const r = await importer.readSource(src, want);
  const result = {
    bookmarks: mergeBookmarks(r.bookmarks),
    history: mergeHistory(r.history),
    passwords: await addPasswords(r.passwords),
    skippedPasswords: r.skippedPasswords,
    passwordsUnsupported: r.passwordsUnsupported
  };
  save();
  return { ...result, allBookmarks: data.bookmarks };
}

async function importFromFile(kind) {
  const isCsv = kind === 'passwords-csv';
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: tr()(isCsv ? 'importPwDialog' : 'importBmDialog'),
    filters: [isCsv ? { name: 'Passwords CSV', extensions: ['csv'] } : { name: 'Bookmarks HTML', extensions: ['html', 'htm'] }],
    properties: ['openFile']
  });
  if (canceled || !filePaths[0]) return { canceled: true };
  try {
    const text = fs.readFileSync(filePaths[0], 'utf8');
    if (isCsv) return { passwords: await addPasswords(importer.passwordsFromCsv(text)) };
    const n = mergeBookmarks(importer.bookmarksFromHtml(text));
    save();
    return { bookmarks: n, allBookmarks: data.bookmarks };
  } catch (e) {
    return { error: e.message };
  }
}

// ---------- new tab shortcuts (added by the user) ----------
const MAX_SHORTCUTS = 12;

function listShortcuts() {
  return data.shortcuts.map((s) => {
    const host = new URL(s.url).host;
    const seen = data.history.find((h) => h.favicon && safeHost(h.url) === host);
    return { ...s, favicon: seen?.favicon || null };
  });
}

function safeHost(url) {
  try { return new URL(url).host; } catch { return ''; }
}

function addShortcut({ title, url } = {}) {
  const t = tr();
  if (data.shortcuts.length >= MAX_SHORTCUTS) return { error: t('maxShortcuts', { n: MAX_SHORTCUTS }) };
  let u = String(url || '').trim();
  if (!u) return { error: t('enterAddress') };
  if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u;
  let parsed;
  try { parsed = new URL(u); } catch { return { error: t('notAddress') }; }
  if (!/^https?:$/.test(parsed.protocol) || (!parsed.hostname.includes('.') && parsed.hostname !== 'localhost')) {
    return { error: t('notAddress') };
  }
  if (data.shortcuts.some((s) => s.url === parsed.href)) return { error: t('shortcutExists') };
  const name = String(title || '').trim().slice(0, 40) || parsed.hostname.replace(/^www\./, '');
  data.shortcuts.push({ title: name, url: parsed.href });
  save();
  return { ok: true };
}

// ---------- Discord Rich Presence ----------
const discord = new DiscordPresence((s) => send('discord-status', s));
const browsingSince = Date.now();
let lastBrowseInfo = { host: '', tabs: 1 };

function updatePresence(info = lastBrowseInfo) {
  lastBrowseInfo = info;
  if (!data.settings.discordRpc) return;
  const tabs = Math.max(1, info.tabs | 0);
  const goose = data.settings.gooseMode;
  const t = tr();
  let details = t(goose ? 'presenceHonking' : 'presenceBrowsing');
  if (!info.host) details = t('presenceNewTab');
  else if (data.settings.discordShowSite) details = t(goose ? 'presenceSiteGoose' : 'presenceSite', { host: info.host }).slice(0, 128);
  discord.setActivity({
    details,
    state: t('presenceTabs', { n: tabs }),
    timestamps: { start: browsingSince },
    assets: { large_image: goose ? 'goose' : 'pigeon', large_text: `${brandName()} ${app.getVersion()}` },
    instance: false
  });
}

// ---------- auto-update (GitHub Releases, packaged builds only) ----------
let autoUpdater = null;
let updateState = { state: 'idle' };

function setUpdateState(s) {
  updateState = s;
  send('update', s);
}

// macOS only lets apps signed with an Apple Developer ID replace themselves, so
// unsigned Mac builds announce new versions and open the download page instead.
const MANUAL_UPDATES = process.platform === 'darwin' && !process.env.PIGEON_MAC_SIGNED;
const RELEASES_PAGE = 'https://github.com/cyansupport/pigeon-web/releases/latest';

// With automatic updates off, nothing is checked or downloaded unless the
// user asks via "Check for updates". An update that has been downloaded
// always installs when the browser is closed.
function applyUpdatePolicy() {
  if (!autoUpdater) return;
  autoUpdater.autoDownload = data.settings.autoUpdate && !MANUAL_UPDATES;
  autoUpdater.autoInstallOnAppQuit = !MANUAL_UPDATES;
}

function autoCheck() {
  if (autoUpdater && data.settings.autoUpdate && updateState.state === 'idle') {
    autoUpdater.checkForUpdates().catch(() => {});
  }
}

function setupUpdater() {
  if (!app.isPackaged) return;
  ({ autoUpdater } = require('electron-updater'));
  applyUpdatePolicy();
  autoUpdater.on('update-available', (i) => setUpdateState(MANUAL_UPDATES
    ? { state: 'manual', version: i.version }
    : { state: 'downloading', version: i.version, percent: 0 }));
  autoUpdater.on('download-progress', (p) =>
    setUpdateState({ ...updateState, state: 'downloading', percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', (i) => setUpdateState({ state: 'ready', version: i.version }));
  autoUpdater.on('error', (e) => {
    console.error('update failed', e);
    if (updateState.state !== 'ready') setUpdateState({ state: 'idle' });
  });
  setTimeout(autoCheck, 8000);
  setInterval(autoCheck, 4 * 60 * 60e3);
}

async function checkForUpdatesNow() {
  if (!autoUpdater) return { result: 'dev' };
  if (['ready', 'downloading', 'manual'].includes(updateState.state)) return { result: updateState.state, ...updateState };
  try {
    const r = await autoUpdater.checkForUpdates();
    const latest = r?.updateInfo?.version;
    if (!latest || latest === app.getVersion()) return { result: 'latest' };
    if (MANUAL_UPDATES) return { result: 'manual', version: latest };
    if (!autoUpdater.autoDownload) autoUpdater.downloadUpdate().catch(() => {});
    return { result: 'downloading', version: latest };
  } catch (e) {
    return { result: 'error', message: e.message };
  }
}

// ---------- IPC ----------
function registerIpc() {
  const fromChrome = (e) => win && e.sender === win.webContents;
  const fromInternalPage = (e) => {
    try { return new URL(e.senderFrame.url).protocol === 'pigeon:'; } catch { return false; }
  };
  const handle = (channel, fn, { internal = false } = {}) => {
    ipcMain.handle(channel, (e, ...args) => {
      if (!fromChrome(e) && !(internal && fromInternalPage(e))) throw new Error('Not allowed');
      return fn(...args);
    });
  };

  handle('state:get', () => ({
    settings: data.settings,
    bookmarks: data.bookmarks,
    session: data.session,
    engines: ENGINES,
    trackerCount: blocklist.size
  }));
  handle('settings:set', (patch = {}) => {
    if (patch.searchEngine in ENGINES) data.settings.searchEngine = patch.searchEngine;
    if (patch.language === 'auto' || patch.language in i18n.LANGS) data.settings.language = patch.language;
    const wasAuto = data.settings.autoUpdate;
    for (const k of ['blockTrackers', 'showBookmarksBar', 'discordRpc', 'discordShowSite', 'gooseMode', 'autoUpdate', 'showDiscordButton']) {
      if (typeof patch[k] === 'boolean') data.settings[k] = patch[k];
    }
    save();
    applyUpdatePolicy();
    if (!wasAuto && data.settings.autoUpdate) autoCheck();
    discord.setEnabled(data.settings.discordRpc);
    updatePresence();
    return data.settings;
  });
  handle('discord:update', (info) => updatePresence({ host: String(info?.host || ''), tabs: Number(info?.tabs) || 1 }));
  handle('discord:status', () => discord.snapshot());
  handle('session:save', (s) => { data.session = s; save(); });

  handle('bookmarks:toggle', ({ url, title, favicon }) => {
    const i = data.bookmarks.findIndex((b) => b.url === url);
    if (i >= 0) data.bookmarks.splice(i, 1);
    else data.bookmarks.push({ url, title: title || url, favicon: favicon || null, added: Date.now() });
    save();
    return data.bookmarks;
  });
  handle('bookmarks:remove', (url) => {
    data.bookmarks = data.bookmarks.filter((b) => b.url !== url);
    save();
    return data.bookmarks;
  });

  handle('history:add', addHistory);
  handle('history:touch', touchHistory);
  handle('history:query', queryHistory);
  handle('history:remove', (id) => { data.history = data.history.filter((h) => h.id !== id); save(); });
  handle('history:clear', () => { data.history = []; save(); });
  handle('suggest', suggest);

  handle('downloads:open', (p) => knownDownloads.has(p) && shell.openPath(p));
  handle('downloads:show', (p) => knownDownloads.has(p) && shell.showItemInFolder(p));
  handle('downloads:cancel', (id) => activeDownloads.get(id)?.cancel());

  handle('update:status', () => ({ ...updateState, current: app.getVersion() }));
  handle('update:check', checkForUpdatesNow);
  handle('update:install', () => {
    if (updateState.state === 'manual') return send('open-tab', { url: RELEASES_PAGE });
    if (updateState.state !== 'ready') return;
    saveNow();
    setImmediate(() => autoUpdater.quitAndInstall(true, true));
  });

  handle('app:close', () => win && win.close());
  handle('app:fullscreen', () => win && win.setFullScreen(!win.isFullScreen()));
  handle('app:about', () => dialog.showMessageBox(win, {
    type: 'info',
    title: tr()('about', { name: brandName() }),
    message: `${brandName()} ${app.getVersion()}`,
    detail: tr()('aboutDetail', { chrome: process.versions.chrome, electron: process.versions.electron, n: blocklist.size }) +
      `\n\n${data.settings.gooseMode ? 'HONK.' : 'Coo. 🐦'}`
  }));

  handle('import:sources', () => importer.detectSources().map(({ id, label, kind }) => ({ id, label, kind })));
  handle('import:run', importFromBrowser);
  handle('import:file', importFromFile);

  handle('passwords:list', (q = '') => {
    q = String(q).toLowerCase();
    return passwords
      .filter((p) => !q || p.origin.toLowerCase().includes(q) || p.username.toLowerCase().includes(q))
      .sort((a, b) => hostnameOf(a.origin).localeCompare(hostnameOf(b.origin)))
      .map((p) => ({ id: p.id, origin: p.origin, host: new URL(p.origin).host.replace(/^www\./, ''), username: p.username }));
  });
  handle('passwords:reveal', (id) => passwords.find((p) => p.id === id)?.password ?? null);
  handle('passwords:copy', (id, field) => {
    const p = passwords.find((x) => x.id === id);
    if (p) clipboard.writeText(field === 'username' ? p.username : p.password);
  });
  handle('passwords:delete', (id) => {
    passwords = passwords.filter((p) => p.id !== id);
    return savePasswords();
  });

  // Login pages ask for saved logins; only the page's own site gets its logins.
  ipcMain.handle('autofill:get', (e) => {
    if (e.sender.getType() !== 'webview' || e.senderFrame?.parent) return [];
    let u;
    try { u = new URL(e.senderFrame.url); } catch { return []; }
    if (u.protocol !== 'https:' && u.hostname !== 'localhost') return [];
    const host = u.hostname.replace(/^www\./, '');
    return passwords
      .filter((p) => hostnameOf(p.origin) === host)
      .sort((a, b) => b.created - a.created)
      .map((p) => ({ username: p.username, password: p.password }));
  });

  // ----- new tab add-ons (widgets & wallpapers) -----
  const handleInternal = (channel, fn) => {
    ipcMain.handle(channel, (e, ...args) => {
      if (!fromInternalPage(e)) throw new Error('Not allowed');
      return fn(e, ...args);
    });
  };
  // addons.js throws short codes; anything else (e.g. no internet) reads as a network error.
  const addonError = (err) => {
    const key = 'err_' + err.message;
    return tr()(i18n.strings.en[key] ? key : 'err_network');
  };
  const addonState = () => ({
    widgets: addons.installed('widgets'),
    wallpapers: addons.installed('wallpapers'),
    layout: data.newtab
  });
  handleInternal('internal:addons', () => addonState());
  handleInternal('internal:store', async (_e, force) => {
    try { return await addons.fetchStore(!!force); } catch { return { error: 'offline' }; }
  });
  handleInternal('internal:install', async (e, kind, id) => {
    try {
      await addons.install(kind, id, (p) => { if (!e.sender.isDestroyed()) e.sender.send('addon-progress', { kind, id, p }); });
      return addonState();
    } catch (err) {
      return { error: addonError(err) };
    }
  });
  handleInternal('internal:uninstall', (_e, kind, id) => {
    addons.uninstall(kind, id);
    if (kind === 'widgets') {
      data.newtab.widgets = data.newtab.widgets.filter((w) => w !== id);
      delete data.widgetConfig[id];
      if (data.newtab.positions) delete data.newtab.positions[id];
    }
    if (kind === 'wallpapers' && data.newtab.wallpaper === id) data.newtab.wallpaper = null;
    save();
    return addonState();
  });
  handleInternal('internal:layout', (_e, patch = {}) => {
    const have = (kind, id) => !!addons.readManifest(kind, id);
    if (Array.isArray(patch.widgets)) {
      data.newtab.widgets = [...new Set(patch.widgets)].filter((id) => typeof id === 'string' && have('widgets', id)).slice(0, 12);
    }
    if (patch.wallpaper === null || (typeof patch.wallpaper === 'string' && have('wallpapers', patch.wallpaper))) {
      data.newtab.wallpaper = patch.wallpaper;
    }
    if (typeof patch.dim === 'number') data.newtab.dim = Math.min(0.8, Math.max(0, patch.dim));
    // Positions are fractions (0–1) of the free space, so they survive window resizes.
    if (patch.positions && typeof patch.positions === 'object') {
      const clamp01 = (v) => Math.min(1, Math.max(0, v));
      const positions = {};
      for (const [id, p] of Object.entries(patch.positions)) {
        if (have('widgets', id) && p && Number.isFinite(p.x) && Number.isFinite(p.y)) positions[id] = { x: clamp01(p.x), y: clamp01(p.y) };
      }
      data.newtab.positions = positions;
    }
    save();
    return addonState();
  });
  handleInternal('internal:widget-config', (_e, id) => data.widgetConfig[id] || {});
  handleInternal('internal:widget-config-save', (_e, id, config) => {
    if (!addons.readManifest('widgets', String(id))) return;
    const json = JSON.stringify(config ?? {});
    if (json.length > 64 * 1024) return;
    data.widgetConfig[id] = JSON.parse(json);
    save();
  });
  handleInternal('internal:custom-wallpaper', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] }],
      properties: ['openFile']
    });
    if (canceled || !filePaths[0]) return addonState();
    try {
      addons.installCustomWallpaper(filePaths[0]);
      data.newtab.wallpaper = 'custom';
      save();
      return addonState();
    } catch (err) {
      return { error: addonError(err) };
    }
  });

  handle('internal:shortcuts', listShortcuts, { internal: true });
  handle('internal:shortcut-add', addShortcut, { internal: true });
  handle('internal:shortcut-remove', (url) => {
    data.shortcuts = data.shortcuts.filter((s) => s.url !== url);
    save();
  }, { internal: true });
  handle('internal:info', () => ({
    engine: (ENGINES[data.settings.searchEngine] || ENGINES.google).name,
    goose: data.settings.gooseMode,
    lang: appLang(),
    platform: process.platform,
    showDiscordButton: data.settings.showDiscordButton !== false
  }), { internal: true });
  handle('internal:navigate', (text) => send('navigate', String(text)), { internal: true });
}

// ---------- app lifecycle ----------
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
    const url = argv.find((a) => /^https?:\/\//i.test(a));
    if (url) send('open-tab', { url });
  });

  app.whenReady().then(async () => {
    load();
    await loadPasswords();
    app.userAgentFallback = app.userAgentFallback.replace(/\s(?:Electron|pigeon-web|Pigeon Web)\/\S+/gi, '');
    addons.init(app.getPath('userData'));
    protocol.handle('pigeon', (req) => {
      const u = new URL(req.url);
      if (u.hostname === 'addons') {
        const file = addons.resolveUrlPath(u.pathname);
        return file ? net.fetch(pathToFileURL(file).toString())
          : new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain' } });
      }
      const rel = u.pathname === '/' || !u.pathname ? `${u.hostname}.html` : decodeURIComponent(u.pathname.slice(1));
      const file = path.normalize(path.join(PAGES, rel));
      if (!file.startsWith(PAGES + path.sep) || !fs.existsSync(file)) {
        return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain' } });
      }
      return net.fetch(pathToFileURL(file).toString());
    });
    if (process.platform === 'darwin') {
      // macOS needs a menu bar: the Edit menu is what makes ⌘C/⌘V/⌘A work in text fields.
      // Tab shortcuts (⌘T, ⌘W, …) are handled in onInput, so they are left out of the menu.
      Menu.setApplicationMenu(Menu.buildFromTemplate([
        { role: 'appMenu' },
        { role: 'editMenu' },
        { label: 'Window', submenu: [{ role: 'minimize' }, { role: 'zoom' }, { type: 'separator' }, { role: 'front' }] }
      ]));
    } else {
      Menu.setApplicationMenu(null);
    }
    setupSession();
    registerIpc();
    createWindow();
    discord.setEnabled(data.settings.discordRpc);
    updatePresence();
    setupUpdater();
  });

  app.on('activate', () => { if (!win) createWindow(); });
  app.on('before-quit', () => { discord.setEnabled(false); saveNow(); });
  app.on('window-all-closed', () => {
    saveNow();
    if (process.platform !== 'darwin') app.quit();
  });
}
