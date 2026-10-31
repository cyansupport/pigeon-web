'use strict';

const api = window.pigeon;
const $ = (s) => document.querySelector(s);
const NEWTAB = 'pigeon://newtab/';
const BRANDS = {
  pigeon: { name: 'Pigeon Web', bird: 'Pigeon', logo: '../pages/pigeon.svg', saved: 'bookmarked' },
  goose: { name: 'Goose Web', bird: 'Goose', logo: '../pages/goose.svg', saved: 'bookmarkedGoose' }
};
const brand = () => (settings.gooseMode ? BRANDS.goose : BRANDS.pigeon);
const I18N = window.PigeonI18n;
const IS_MAC = api.platform === 'darwin';
let lang = ''; // set on the first applySettings(), which also translates the static labels
let t = I18N.make('en', { mac: IS_MAC });
const keyLabel = (k) => (IS_MAC ? I18N.macKeys(k) : k);
const DISCORD_INVITE = 'https://discord.gg/aymngeTrWY';
const ZOOMS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5];

const svg = (inner) => `<svg viewBox="0 0 24 24">${inner}</svg>`;
const ICON = {
  globe: svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'),
  lock: svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
  warn: svg('<path d="M12 3l10 18H2z"/><path d="M12 10v4M12 17.5h.01"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'),
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  reload: svg('<path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v5h-5"/>'),
  stop: svg('<path d="M18 6L6 18M6 6l12 12"/>'),
  close: svg('<path d="M18 6L6 18M6 6l12 12"/>'),
  audio: svg('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  minus: svg('<path d="M5 12h14"/>'),
  expand: svg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  history: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  star: svg('<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z"/>'),
  download: svg('<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>'),
  find: svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'),
  print: svg('<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>'),
  code: svg('<path d="M8 6l-6 6 6 6M16 6l6 6-6 6"/>'),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>'),
  restore: svg('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>'),
  tab: svg('<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 10h18"/>'),
  update: svg('<circle cx="12" cy="12" r="9"/><path d="M12 16V8M8.5 11.5L12 8l3.5 3.5"/>'),
  import: svg('<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>'),
  key: svg('<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>'),
  discord: svg('<path d="M8 7.5c2.6-.8 5.4-.8 8 0M8 16.5c2.6.8 5.4.8 8 0"/><path d="M7.5 7.5C5.5 10 5 13 5.3 16.3c1.2.9 2.5 1.5 3.7 1.7l1-1.8M16.5 7.5c2 2.5 2.5 5.5 2.2 8.8-1.2.9-2.5 1.5-3.7 1.7l-1-1.8"/><circle cx="9.5" cy="12.5" r="1"/><circle cx="14.5" cy="12.5" r="1"/>')
};

// ---------- state ----------
let settings = {};
let bookmarks = [];
let engines = {};
let trackerCount = 0;
const tabs = [];
let active = null;
let nextId = 1;
const closedTabs = [];
const downloads = new Map();
let panelView = null;
let addressDirty = false;

const els = {
  tabs: $('#tabs'), newTab: $('#new-tab'), views: $('#views'),
  back: $('#back'), forward: $('#forward'), reload: $('#reload'), home: $('#home'),
  omnibox: $('#omnibox'), address: $('#address'), siteIcon: $('#site-icon'), star: $('#star'),
  zoomBadge: $('#zoom-badge'), suggestions: $('#suggestions'),
  shield: $('#shield'), downloadsBtn: $('#downloads-btn'), panelBtn: $('#panel-btn'), menuBtn: $('#menu-btn'),
  bookmarksBar: $('#bookmarks-bar'), panel: $('#panel'), panelBody: $('#panel-body'),
  errorPage: $('#error-page'), errorText: $('#error-text'), errorCode: $('#error-code'),
  findbar: $('#findbar'), findInput: $('#find-input'), findCount: $('#find-count'),
  popover: $('#popover'), toast: $('#toast')
};

// ---------- helpers ----------
function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c);
  return el;
}

// Colored letter badge for sites without a usable favicon, stable per domain.
function letterIcon(pageUrl) {
  const host = hostOf(pageUrl) || '';
  if (!/^https?:/i.test(pageUrl || '') || !host) return h('span', { class: 'fav', html: ICON.globe });
  let hash = 0;
  for (const c of host) hash = (hash * 31 + c.charCodeAt(0)) | 0;
  return h('span', {
    class: 'letter-ico',
    text: host[0].toUpperCase(),
    style: `background: hsl(${Math.abs(hash) % 360} 58% 50%)`
  });
}

// Site icon: the page's favicon, then the site's /favicon.ico, then a letter badge.
function favicon(url, pageUrl) {
  if (isNewTab(pageUrl)) return h('img', { src: brand().logo, alt: '' });
  const sources = [url];
  if (/^https?:/i.test(pageUrl || '')) sources.push(safe(() => new URL('/favicon.ico', pageUrl).href, null));
  const queue = [...new Set(sources.filter(Boolean))];
  if (!queue.length) return letterIcon(pageUrl);
  const img = h('img', { src: queue.shift(), alt: '' });
  img.addEventListener('error', () => {
    if (queue.length) img.src = queue.shift();
    else img.replaceWith(letterIcon(pageUrl));
  });
  return img;
}

const safe = (fn, fallback) => { try { return fn(); } catch { return fallback; } };
const isNewTab = (url) => !url || url.startsWith('pigeon://newtab');
const displayUrl = (url) => (isNewTab(url) ? '' : url);
const hostOf = (url) => safe(() => new URL(url).host.replace(/^www\./, ''), url);
const engine = () => engines[settings.searchEngine] || engines.google || { name: 'Google', url: 'https://www.google.com/search?q=' };

function toUrl(text) {
  const t = text.trim();
  if (!t) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(t) || /^(about|view-source|data|file|pigeon|chrome):/i.test(t)) return t;
  if (/^localhost(:\d+)?(\/|$)/i.test(t) || /^(\d{1,3}\.){3}\d{1,3}(:\d+)?(\/|$)/.test(t)) return 'http://' + t;
  if (!/\s/.test(t) && /^[^\s/]+\.[a-z]{2,}(:\d+)?([/?#].*)?$/i.test(t)) return 'https://' + t;
  return engine().url + encodeURIComponent(t);
}

let toastTimer;
function toast(msg) {
  els.toast.textContent = msg;
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { els.toast.hidden = true; }, 2200);
}

function formatBytes(n) {
  if (!n) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), u.length - 1);
  return (n / 1024 ** i).toFixed(i ? 1 : 0) + ' ' + u[i];
}

// ---------- tabs ----------
function createTab(url = NEWTAB, opts = {}) {
  const tab = {
    id: nextId++, url, title: opts.title || (isNewTab(url) ? '' : hostOf(url)),
    favicon: null, loading: false, ready: false, wv: null, wcId: null,
    blocked: 0, error: null, audible: false, zoom: 1, iconKey: ''
  };
  tab.el = h('div', { class: 'tab opening', draggable: 'true' },
    h('span', { class: 'tab-sep' }),
    h('span', { class: 'tab-icon' }),
    h('span', { class: 'tab-title' }),
    h('span', { class: 'tab-audio', html: ICON.audio, hidden: true }),
    h('button', { class: 'tab-close', title: t('closeTabTip'), html: ICON.close })
  );
  bindTabElement(tab);

  const index = Math.min(opts.index ?? tabs.length, tabs.length);
  els.tabs.insertBefore(tab.el, tabs[index]?.el || null);
  tabs.splice(index, 0, tab);

  if (!opts.lazy) ensureView(tab);
  renderTab(tab);
  if (!opts.background) activate(tab);
  layoutTabs();
  saveSession();
  return tab;
}

function ensureView(tab) {
  if (tab.wv) return tab.wv;
  const wv = document.createElement('webview');
  wv.className = 'view hidden';
  wv.setAttribute('allowpopups', '');
  wv.setAttribute('src', tab.url || NEWTAB);
  tab.wv = wv;
  bindView(tab);
  els.views.appendChild(wv);
  return wv;
}

let dragTab = null;
function bindTabElement(tab) {
  const { el } = tab;
  el.addEventListener('mousedown', (e) => { if (e.button === 0 && !e.target.closest('.tab-close')) activate(tab); });
  el.addEventListener('auxclick', (e) => { if (e.button === 1) closeTab(tab); });
  el.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); });
  el.querySelector('.tab-close').addEventListener('click', (e) => { e.stopPropagation(); closeTab(tab); });
  el.addEventListener('animationend', () => el.classList.remove('opening'), { once: true });
  el.addEventListener('dragstart', (e) => {
    dragTab = tab;
    el.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  el.addEventListener('dragend', () => {
    el.classList.remove('dragging');
    dragTab = null;
    const order = [...els.tabs.children];
    tabs.sort((a, b) => order.indexOf(a.el) - order.indexOf(b.el));
    saveSession();
  });
}

els.tabs.addEventListener('dragover', (e) => {
  if (!dragTab) return;
  e.preventDefault();
  const after = [...els.tabs.children].find((c) => {
    if (c === dragTab.el) return false;
    const r = c.getBoundingClientRect();
    return e.clientX < r.left + r.width / 2;
  });
  if (after !== dragTab.el.nextSibling) els.tabs.insertBefore(dragTab.el, after || null);
});

function bindView(tab) {
  const wv = tab.wv;
  const isActive = () => tab === active;
  const grabId = () => { if (!tab.wcId) tab.wcId = safe(() => wv.getWebContentsId(), null); };

  wv.addEventListener('dom-ready', () => {
    tab.ready = true;
    grabId();
    if (isActive()) { updateNav(); updateZoom(); }
  });
  wv.addEventListener('did-start-loading', () => {
    grabId();
    tab.loading = true;
    renderTab(tab);
    if (isActive()) updateNav();
  });
  wv.addEventListener('did-stop-loading', () => {
    tab.loading = false;
    renderTab(tab);
    if (isActive()) { updateNav(); updateZoom(); }
  });
  wv.addEventListener('did-start-navigation', (e) => {
    if (!e.isMainFrame || e.isInPlace || e.isSameDocument) return;
    tab.error = null;
    tab.blocked = 0;
    if (isActive()) { updateError(); updateShield(); }
  });
  wv.addEventListener('did-navigate', (e) => {
    tab.url = e.url;
    tab.favicon = null;
    if (!isNewTab(e.url)) tab.title = hostOf(e.url);
    onUrlChange(tab, e.url);
  });
  wv.addEventListener('did-navigate-in-page', (e) => {
    if (!e.isMainFrame) return;
    tab.url = e.url;
    onUrlChange(tab, tab.title);
  });
  wv.addEventListener('page-title-updated', (e) => {
    tab.title = e.title;
    renderTab(tab);
    if (isActive()) document.title = `${tabTitle(tab)} - ${brand().name}`;
    api.invoke('history:touch', { url: tab.url, title: e.title });
    saveSession();
  });
  wv.addEventListener('page-favicon-updated', (e) => {
    tab.favicon = e.favicons[0] || null;
    renderTab(tab);
    if (tab.favicon) api.invoke('history:touch', { url: tab.url, favicon: tab.favicon });
  });
  wv.addEventListener('did-fail-load', (e) => {
    if (!e.isMainFrame || e.errorCode === -3) return; // -3 = aborted, not a real failure
    tab.error = { code: e.errorCode, desc: e.errorDescription, url: e.validatedURL };
    tab.title = hostOf(e.validatedURL) || t('pageNotFound');
    renderTab(tab);
    if (isActive()) updateError();
  });
  wv.addEventListener('found-in-page', (e) => { if (isActive()) updateFindCount(e.result); });
  wv.addEventListener('media-started-playing', () => { tab.audible = true; renderTab(tab); });
  wv.addEventListener('media-paused', () => { tab.audible = false; renderTab(tab); });
  wv.addEventListener('enter-html-full-screen', () => document.body.classList.add('html-fs'));
  wv.addEventListener('leave-html-full-screen', () => document.body.classList.remove('html-fs'));
  wv.addEventListener('close', () => closeTab(tab));
  wv.addEventListener('focus', hideFloating);
}

function onUrlChange(tab, title) {
  renderTab(tab);
  if (tab === active) { updateAddress(); updateNav(); updateStar(); updateZoom(); }
  if (/^https?:/i.test(tab.url)) api.invoke('history:add', { url: tab.url, title });
  saveSession();
}

const tabTitle = (tab) => (isNewTab(tab.url) ? t('newTab') : tab.title || displayUrl(tab.url));

function renderTab(tab) {
  const { el } = tab;
  const title = tabTitle(tab);
  el.querySelector('.tab-title').textContent = title;
  el.title = title;
  el.querySelector('.tab-audio').hidden = !tab.audible;
  const key = tab.loading ? 'loading' : isNewTab(tab.url) ? 'newtab' : tab.favicon || 'host:' + hostOf(tab.url);
  if (key !== tab.iconKey) {
    tab.iconKey = key;
    const icon = el.querySelector('.tab-icon');
    icon.replaceChildren(tab.loading ? h('span', { class: 'spinner' }) : favicon(tab.favicon, tab.url));
  }
}

function layoutTabs() {
  const width = els.tabs.clientWidth / Math.max(tabs.length, 1);
  for (const t of tabs) t.el.classList.toggle('compact', tabs.length > 1 && width < 84);
}
window.addEventListener('resize', layoutTabs);

function activate(tab) {
  if (!tab) return;
  ensureView(tab);
  const changed = active !== tab;
  active = tab;
  for (const t of tabs) {
    t.el.classList.toggle('active', t === tab);
    t.wv?.classList.toggle('hidden', t !== tab);
  }
  tab.el.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  addressDirty = false;
  hideSuggestions();
  updateAddress();
  updateNav();
  updateStar();
  updateShield();
  updateError();
  updateZoom();
  document.title = `${tabTitle(tab)} - ${brand().name}`;
  if (changed) {
    closeFind();
    if (isNewTab(tab.url)) focusAddress();
    else tab.wv.focus();
    saveSession();
  }
}

function closeTab(tab) {
  const i = tabs.indexOf(tab);
  if (i < 0) return;
  if (!isNewTab(tab.url)) {
    closedTabs.push({ url: tab.url, title: tab.title, index: i });
    if (closedTabs.length > 25) closedTabs.shift();
  }
  tabs.splice(i, 1);
  tab.el.remove();
  tab.wv?.remove();
  if (!tabs.length) {
    saveSession(true);
    api.invoke('app:close');
    return;
  }
  if (tab === active) activate(tabs[Math.min(i, tabs.length - 1)]);
  layoutTabs();
  saveSession();
}

function reopenTab() {
  const t = closedTabs.pop();
  if (t) createTab(t.url, { index: t.index, title: t.title });
}

let presenceTimer;
function reportPresence() {
  clearTimeout(presenceTimer);
  presenceTimer = setTimeout(() => {
    const host = active && /^https?:/i.test(active.url) ? hostOf(active.url) : '';
    api.invoke('discord:update', { host, tabs: tabs.length });
  }, 300);
}

let sessionTimer;
function saveSession(now = false) {
  reportPresence();
  clearTimeout(sessionTimer);
  const write = () => api.invoke('session:save', {
    tabs: tabs.filter((t) => !t.url.startsWith('view-source:')).map((t) => ({ url: t.url, title: t.title })),
    active: Math.max(0, tabs.indexOf(active))
  });
  if (now) write();
  else sessionTimer = setTimeout(write, 500);
}

// ---------- navigation ----------
function load(tab, url) {
  tab.url = url;
  tab.error = null;
  if (!tab.wv) return activate(tab);
  if (tab.ready) tab.wv.loadURL(url).catch(() => {});
  else tab.wv.src = url;
  if (tab === active) { updateAddress(true); updateError(); }
}

function navigate(text, tab = active) {
  const url = toUrl(text);
  if (!url) return;
  addressDirty = false;
  hideSuggestions();
  load(tab, url);
  tab.wv?.focus();
}

const withView = (fn) => { if (active?.wv && active.ready) safe(() => fn(active.wv)); };

function goBack() { withView((wv) => wv.canGoBack() && wv.goBack()); }
function goForward() { withView((wv) => wv.canGoForward() && wv.goForward()); }
function reload(hard = false) {
  if (active.error && !active.ready) return load(active, active.url);
  withView((wv) => (hard ? wv.reloadIgnoringCache() : wv.reload()));
}

els.back.addEventListener('click', goBack);
els.forward.addEventListener('click', goForward);
els.reload.addEventListener('click', () => (active.loading ? withView((wv) => wv.stop()) : reload()));
els.home.addEventListener('click', () => load(active, NEWTAB));
els.newTab.addEventListener('click', () => createTab());
$('#titlebar').addEventListener('dblclick', (e) => { if (e.target.id === 'tabs') createTab(); });
$('#error-retry').addEventListener('click', () => load(active, active.error?.url || active.url));

function updateNav() {
  if (!active) return;
  const ready = active.ready;
  els.back.disabled = !(ready && safe(() => active.wv.canGoBack(), false));
  els.forward.disabled = !(ready && safe(() => active.wv.canGoForward(), false));
  els.reload.innerHTML = active.loading ? ICON.stop : ICON.reload;
  els.reload.title = t(active.loading ? 'stopTip' : 'reloadTip');
}

function updateAddress(force = false) {
  if (!active) return;
  if (!force && addressDirty && document.activeElement === els.address) return;
  els.address.value = displayUrl(active.url);
  const u = active.url || '';
  let cls = '', icon = ICON.globe, title = '';
  if (isNewTab(u)) { icon = ICON.search; }
  else if (u.startsWith('https:')) { cls = 'secure'; icon = ICON.lock; title = t('secure'); }
  else if (u.startsWith('http:')) { cls = 'insecure'; icon = ICON.warn; title = t('insecure'); }
  els.siteIcon.className = cls;
  els.siteIcon.innerHTML = icon;
  els.siteIcon.title = title;
}

function updateError() {
  const err = active?.error;
  els.errorPage.hidden = !err;
  if (!err) return;
  els.errorText.textContent = t('errText', { bird: brand().bird, host: hostOf(err.url) || err.url });
  els.errorCode.textContent = `${err.desc} (${err.code})`;
}

function focusAddress() {
  els.address.focus();
  els.address.select();
}

// ---------- omnibox & suggestions ----------
let sugItems = [];
let sugIndex = 0;
let sugSeq = 0;

els.address.addEventListener('focus', () => setTimeout(() => els.address.select(), 0));
els.address.addEventListener('blur', () => setTimeout(() => {
  hideSuggestions();
  if (!addressDirty) updateAddress(true);
}, 120));
els.address.addEventListener('input', async () => {
  addressDirty = true;
  const q = els.address.value.trim();
  if (!q) return hideSuggestions();
  const seq = ++sugSeq;
  const results = await api.invoke('suggest', q);
  if (seq !== sugSeq) return;
  const url = toUrl(q);
  const isSearch = url.startsWith(engine().url);
  sugItems = [{ url, primary: true, title: isSearch ? q : url, sub: isSearch ? t('engineSearch', { engine: engine().name }) : t('openAddress') }];
  for (const r of results) if (r.url !== url) sugItems.push(r);
  sugIndex = 0;
  renderSuggestions(isSearch);
});
els.address.addEventListener('keydown', (e) => {
  const open = !els.suggestions.hidden;
  if (e.key === 'Enter') {
    e.preventDefault();
    const item = open && sugItems[sugIndex];
    if (item && !item.primary) { addressDirty = false; hideSuggestions(); load(active, item.url); active.wv?.focus(); }
    else navigate(els.address.value);
  } else if (e.key === 'Escape') {
    if (open) hideSuggestions();
    else { addressDirty = false; updateAddress(true); active.wv?.focus(); }
  } else if (open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
    e.preventDefault();
    sugIndex = (sugIndex + (e.key === 'ArrowDown' ? 1 : -1) + sugItems.length) % sugItems.length;
    [...els.suggestions.children].forEach((c, i) => c.classList.toggle('sel', i === sugIndex));
  }
});

function renderSuggestions(isSearch) {
  els.suggestions.replaceChildren(...sugItems.map((s, i) => {
    const icon = s.primary ? h('span', { class: 'fav', html: isSearch ? ICON.search : ICON.arrow }) : favicon(s.favicon, s.url);
    return h('div', {
      class: 'sug' + (i === sugIndex ? ' sel' : ''),
      onmousedown: (e) => {
        e.preventDefault();
        addressDirty = false;
        hideSuggestions();
        if (s.primary) navigate(els.address.value);
        else { load(active, s.url); active.wv?.focus(); }
      }
    },
      icon,
      h('span', { class: 't' },
        s.title || s.url,
        h('span', { class: 'u', text: s.primary ? `  —  ${s.sub}` : `  —  ${hostOf(s.url)}` })),
      s.bookmark ? h('span', { class: 'tag', text: t('bookmarkTag') }) : null
    );
  }));
  els.suggestions.hidden = false;
}

function hideSuggestions() { els.suggestions.hidden = true; sugItems = []; }

// ---------- bookmarks ----------
const isBookmarked = (url) => bookmarks.some((b) => b.url === url);

function updateStar() {
  const on = active && isBookmarked(active.url);
  els.star.classList.toggle('on', on);
  els.star.hidden = !active || isNewTab(active.url);
  els.star.title = t(on ? 'removeBookmarkTip' : 'bookmarkThisTip');
}

async function toggleBookmark() {
  if (!active || isNewTab(active.url)) return;
  const was = isBookmarked(active.url);
  bookmarks = await api.invoke('bookmarks:toggle', { url: active.url, title: active.title, favicon: active.favicon });
  toast(t(was ? 'bookmarkRemoved' : brand().saved));
  bookmarksChanged();
}

async function removeBookmark(url) {
  bookmarks = await api.invoke('bookmarks:remove', url);
  bookmarksChanged();
}

function bookmarksChanged() {
  updateStar();
  renderBookmarksBar();
  if (panelView === 'bookmarks') renderPanel();
}

function renderBookmarksBar() {
  if (!bookmarks.length) {
    els.bookmarksBar.replaceChildren(h('span', { class: 'bm-hint', text: t('bmHint') }));
    return;
  }
  els.bookmarksBar.replaceChildren(...bookmarks.map((b) => h('button', {
    class: 'bm', title: `${b.title}\n${b.url}`,
    onclick: () => load(active, b.url),
    onauxclick: (e) => { if (e.button === 1) createTab(b.url, { background: true, index: tabs.indexOf(active) + 1 }); },
    oncontextmenu: (e) => { e.preventDefault(); showBookmarkMenu(b, e.currentTarget); }
  }, favicon(b.favicon, b.url), h('span', { text: b.title || hostOf(b.url) }))));
}

function showBookmarkMenu(b, anchor) {
  showPopover(anchor, [
    menuItem(ICON.tab, t('openInNewTab'), '', () => createTab(b.url, { index: tabs.indexOf(active) + 1 })),
    menuItem(ICON.code, t('copyAddress'), '', () => { navigator.clipboard.writeText(b.url); toast(t('addressCopied')); }),
    menuItem(ICON.close, t('removeBookmark'), '', () => removeBookmark(b.url))
  ], 'left');
}

els.star.addEventListener('click', toggleBookmark);

// ---------- tracker shield ----------
let shieldFrame = 0;
function updateShield() {
  const badge = els.shield.querySelector('.badge');
  const n = active?.blocked || 0;
  els.shield.classList.toggle('off', !settings.blockTrackers);
  badge.hidden = !settings.blockTrackers || n === 0;
  badge.textContent = n > 99 ? '99+' : n;
  els.shield.title = settings.blockTrackers ? t('shieldOnTip', { n }) : t('shieldOffTip');
}

api.on('blocked', (wcId) => {
  const tab = tabs.find((t) => t.wcId === wcId);
  if (!tab) return;
  tab.blocked++;
  if (tab === active && !shieldFrame) shieldFrame = requestAnimationFrame(() => { shieldFrame = 0; updateShield(); });
});

els.shield.addEventListener('click', () => {
  const n = active?.blocked || 0;
  showPopover(els.shield, [
    h('div', { class: 'pop-hero' },
      h('div', { class: 'big', text: settings.blockTrackers ? n : '—' }),
      h('div', {},
        h('div', { text: settings.blockTrackers ? t('trackersBlocked', { n }) : t('blockingOff') }),
        h('div', { class: 's', text: t('blocklistInfo', { site: isNewTab(active.url) ? t('newTab') : hostOf(active.url), n: trackerCount }) }))),
    h('div', { class: 'sep' }),
    toggleRow(t('blockTrackers'), settings.blockTrackers, async (on) => {
      await setSetting({ blockTrackers: on });
      toast(t(on ? 'trackersOnToast' : 'trackersOffToast'));
    })
  ]);
});

// ---------- zoom ----------
function updateZoom() {
  if (!active?.ready) { els.zoomBadge.hidden = true; return; }
  active.zoom = safe(() => active.wv.getZoomFactor(), 1);
  els.zoomBadge.hidden = Math.abs(active.zoom - 1) < 0.001;
  els.zoomBadge.textContent = Math.round(active.zoom * 100) + '%';
}

function zoom(dir) {
  withView((wv) => {
    const cur = wv.getZoomFactor();
    let next = 1;
    if (dir > 0) next = ZOOMS.find((z) => z > cur + 0.001) ?? ZOOMS[ZOOMS.length - 1];
    if (dir < 0) next = [...ZOOMS].reverse().find((z) => z < cur - 0.001) ?? ZOOMS[0];
    wv.setZoomFactor(next);
  });
  updateZoom();
  const label = document.querySelector('#zoom-level');
  if (label) label.textContent = Math.round(active.zoom * 100) + '%';
}
els.zoomBadge.addEventListener('click', () => zoom(0));

// ---------- find in page ----------
function openFind() {
  if (!active?.ready || isNewTab(active.url)) return;
  els.findbar.hidden = false;
  els.findInput.focus();
  els.findInput.select();
  if (els.findInput.value) withView((wv) => wv.findInPage(els.findInput.value));
}

function closeFind() {
  if (els.findbar.hidden) return;
  els.findbar.hidden = true;
  els.findCount.textContent = '';
  for (const t of tabs) if (t.ready) safe(() => t.wv.stopFindInPage('clearSelection'));
}

function findStep(forward) {
  const q = els.findInput.value;
  if (q) withView((wv) => wv.findInPage(q, { forward, findNext: true }));
}

function updateFindCount(r) {
  els.findCount.textContent = els.findInput.value ? `${r.matches ? r.activeMatchOrdinal : 0}/${r.matches}` : '';
}

els.findInput.addEventListener('input', () => {
  const q = els.findInput.value;
  if (q) withView((wv) => wv.findInPage(q));
  else { els.findCount.textContent = ''; withView((wv) => wv.stopFindInPage('clearSelection')); }
});
els.findInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') findStep(!e.shiftKey);
  if (e.key === 'Escape') { closeFind(); active.wv?.focus(); }
});
$('#find-next').addEventListener('click', () => findStep(true));
$('#find-prev').addEventListener('click', () => findStep(false));
$('#find-close').addEventListener('click', closeFind);

// ---------- popovers & menu ----------
function showPopover(anchor, children, align = 'right') {
  hideFloating();
  els.popover.replaceChildren(...children.filter(Boolean));
  els.popover.hidden = false;
  const r = anchor.getBoundingClientRect();
  const w = els.popover.offsetWidth;
  const left = align === 'right' ? r.right - w : r.left;
  els.popover.style.left = Math.max(8, Math.min(left, innerWidth - w - 8)) + 'px';
  els.popover.style.top = r.bottom + 6 + 'px';
  els.popover.anchor = anchor;
}

function hidePopover() { els.popover.hidden = true; els.popover.anchor = null; }
function hideFloating() { hidePopover(); hideSuggestions(); }

function menuItem(icon, label, key, fn, disabled = false) {
  return h('button', {
    class: 'mi', disabled,
    onclick: () => { hidePopover(); fn(); }
  }, h('span', { class: 'fav', html: icon }), h('span', { text: label }), key ? h('span', { class: 'k', text: keyLabel(key) }) : null);
}

function toggleRow(label, on, fn) {
  const sw = h('button', { class: 'switch' + (on ? ' on' : ''), 'aria-pressed': String(on) });
  sw.addEventListener('click', () => {
    const next = !sw.classList.contains('on');
    sw.classList.toggle('on', next);
    fn(next);
  });
  return h('div', { class: 'mi-row' }, h('span', { class: 'label', text: label }), sw);
}

const sep = () => h('div', { class: 'sep' });

function openMenu() {
  if (els.popover.anchor === els.menuBtn) return hidePopover();
  const z = Math.round((active?.zoom || 1) * 100);
  const engineSelect = h('select', { class: 'field' },
    ...Object.entries(engines).map(([id, e]) => h('option', { value: id, text: e.name, selected: id === settings.searchEngine })));
  engineSelect.addEventListener('change', () => setSetting({ searchEngine: engineSelect.value }));
  const langSelect = h('select', { class: 'field' },
    h('option', { value: 'auto', text: t('langAuto'), selected: !settings.language || settings.language === 'auto' }),
    ...Object.entries(I18N.LANGS).map(([id, label]) => h('option', { value: id, text: label, selected: id === settings.language })));
  langSelect.addEventListener('change', async () => {
    await setSetting({ language: langSelect.value });
    hidePopover();
    openMenu();
  });
  const reopenMenu = () => { hidePopover(); openMenu(); };

  showPopover(els.menuBtn, [
    menuItem(ICON.plus, t('menuNewTab'), 'Ctrl+T', () => createTab()),
    menuItem(ICON.restore, t('reopenTab'), 'Ctrl+Shift+T', reopenTab, !closedTabs.length),
    sep(),
    menuItem(ICON.history, t('history'), IS_MAC ? 'Ctrl+Y' : 'Ctrl+H', () => openPanel('history')),
    menuItem(ICON.star, t('bookmarks'), 'Ctrl+Shift+O', () => openPanel('bookmarks')),
    menuItem(ICON.download, t('downloads'), 'Ctrl+J', () => openPanel('downloads')),
    menuItem(ICON.key, t('passwords'), '', () => openPanel('passwords')),
    menuItem(ICON.import, t('importMenu'), '', openImport),
    sep(),
    h('div', { class: 'mi-row' },
      h('span', { class: 'label', text: t('zoom') }),
      h('div', { class: 'zoom-ctl' },
        h('button', { class: 'icon-btn small', title: t('zoomOutTip'), html: ICON.minus, onclick: () => zoom(-1) }),
        h('span', { id: 'zoom-level', text: z + '%' }),
        h('button', { class: 'icon-btn small', title: t('zoomInTip'), html: ICON.plus, onclick: () => zoom(1) })),
      h('button', { class: 'icon-btn small', title: t('fullscreenTip'), html: ICON.expand, onclick: () => { hidePopover(); api.invoke('app:fullscreen'); } })),
    menuItem(ICON.find, t('findMenu'), 'Ctrl+F', openFind),
    menuItem(ICON.print, t('printMenu'), 'Ctrl+P', () => withView((wv) => wv.print())),
    sep(),
    h('div', { class: 'mi-row' }, h('span', { class: 'label', text: t('language') }), langSelect),
    h('div', { class: 'mi-row' }, h('span', { class: 'label', text: t('searchEngine') }), engineSelect),
    toggleRow(t('blockTrackers'), settings.blockTrackers, (on) => setSetting({ blockTrackers: on })),
    toggleRow(t('showBookmarksBar'), settings.showBookmarksBar, (on) => setSetting({ showBookmarksBar: on })),
    toggleRow(t('gooseMode'), settings.gooseMode, async (on) => {
      await setSetting({ gooseMode: on });
      toast(t(on ? 'gooseOnToast' : 'gooseOffToast'));
      reopenMenu();
    }),
    sep(),
    toggleRow(t('discordStatus'), settings.discordRpc, async (on) => {
      await setSetting({ discordRpc: on });
      reopenMenu();
    }),
    settings.discordRpc
      ? toggleRow(t('discordShowSite'), settings.discordShowSite, (on) => setSetting({ discordShowSite: on }))
      : null,
    settings.discordRpc ? h('div', { id: 'discord-status', class: 'mi-note' }) : null,
    sep(),
    menuItem(ICON.code, t('devtools'), IS_MAC ? '⌥⌘I' : 'F12', () => withView((wv) => wv.openDevTools())),
    toggleRow(t('autoUpdate'), settings.autoUpdate !== false, (on) => {
      setSetting({ autoUpdate: on });
      toast(t(on ? 'autoOnToast' : 'autoOffToast'));
    }),
    menuItem(ICON.update, updateMenuLabel(), '', checkForUpdates),
    menuItem(ICON.discord, t('joinDiscord', { name: brand().name }), '', () => createTab(DISCORD_INVITE, { index: tabs.indexOf(active) + 1 })),
    menuItem(ICON.info, t('about', { name: brand().name }), '', () => api.invoke('app:about'))
  ]);
  renderDiscordStatus();
}

// ---------- updates ----------
let updateState = { state: 'idle' };

function updateMenuLabel() {
  if (updateState.state === 'manual') return t('updDownloadNew', { v: updateState.version });
  if (updateState.state === 'ready') return t('restartToUpdate', { v: updateState.version });
  if (updateState.state === 'downloading') return t('downloadingUpdate', { p: updateState.percent || 0 });
  return t('checkUpdates');
}

function renderUpdate() {
  const btn = $('#update-btn');
  btn.hidden = updateState.state !== 'ready' && updateState.state !== 'manual';
  btn.title = updateState.state === 'manual'
    ? t('updDownloadNew', { v: updateState.version })
    : t('updateTip', { v: updateState.version, name: brand().name });
}

async function checkForUpdates() {
  if (updateState.state === 'ready' || updateState.state === 'manual') return api.invoke('update:install');
  const r = await api.invoke('update:check');
  if (r.result === 'manual') {
    updateState = { ...updateState, state: 'manual', version: r.version };
    renderUpdate();
    toast(t('updManual', { v: r.version }));
  } else if (r.result === 'dev') toast(t('updDev'));
  else if (r.result === 'latest') toast(t('updLatest', { v: updateState.current }));
  else if (r.result === 'downloading') toast(t('updDownloading', { v: r.version }));
  else if (r.result === 'error') toast(t('updError'));
}

api.on('update', (s) => {
  const wasReady = updateState.state === 'ready';
  updateState = { ...updateState, ...s };
  renderUpdate();
  if (s.state === 'ready' && !wasReady) toast(t('updReady', { v: s.version, name: brand().name }));
  if (s.state === 'manual') toast(t('updManual', { v: s.version }));
});
$('#update-btn').addEventListener('click', () => api.invoke('update:install'));

let discordStatus = { status: 'off', message: '' };
const DISCORD_CODES = { 'not-running': 'discordNotRunning', lost: 'discordLost', 'no-id': 'discordNoId' };
function renderDiscordStatus() {
  const el = document.querySelector('#discord-status');
  if (!el) return;
  const { status, message, code, user } = discordStatus;
  let text = message || '';
  if (status === 'off') text = '';
  else if (status === 'connecting') text = t('discordConnecting');
  else if (status === 'connected') text = user ? t('discordConnected', { user }) : t('discordConnectedPlain');
  else if (DISCORD_CODES[code]) text = t(DISCORD_CODES[code]);
  el.textContent = text;
  el.className = 'mi-note' + (status === 'connected' ? ' ok' : status === 'error' ? ' err' : '');
}
api.on('discord-status', (s) => { discordStatus = s; renderDiscordStatus(); });
els.menuBtn.addEventListener('click', openMenu);

document.addEventListener('mousedown', (e) => {
  if (!els.popover.hidden && !els.popover.contains(e.target) && !els.popover.anchor?.contains(e.target)) hidePopover();
});
window.addEventListener('blur', hidePopover);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!els.popover.hidden) hidePopover();
    else if (active?.loading && document.activeElement !== els.address) withView((wv) => wv.stop());
  }
});

async function setSetting(patch) {
  settings = await api.invoke('settings:set', patch);
  applySettings();
}

function applySettings() {
  document.body.classList.toggle('no-bbar', !settings.showBookmarksBar);
  const goose = !!settings.gooseMode;
  const gooseChanged = document.body.classList.contains('goose') !== goose;
  const nextLang = I18N.resolve(settings.language, navigator.language);
  const langChanged = nextLang !== lang;
  if (langChanged) {
    lang = nextLang;
    t = I18N.make(lang, { mac: IS_MAC });
    document.documentElement.lang = lang;
    translateStatic();
  }
  if (gooseChanged) {
    document.body.classList.toggle('goose', goose);
    $('.brand').src = brand().logo;
    $('.brand').alt = brand().name;
    $('#error-page img').src = brand().logo;
  }
  if (gooseChanged || langChanged) {
    for (const tab of tabs) {
      tab.iconKey = '';
      tab.el.querySelector('.tab-close').title = t('closeTabTip');
      renderTab(tab);
      if (isNewTab(tab.url) && tab.ready) safe(() => tab.wv.reload());
    }
    if (active) {
      document.title = `${tabTitle(active)} - ${brand().name}`;
      updateNav();
      updateAddress(true);
      updateStar();
      updateError();
    }
    renderBookmarksBar();
    renderUpdate();
    if (panelView) renderPanel();
  }
  els.address.placeholder = t('addressPlaceholder', { engine: engine().name });
  updateShield();
}

// Labels written in index.html (data-i18n / data-i18n-title / data-i18n-placeholder).
function translateStatic() {
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  if (IS_MAC) els.panelBtn.title = els.panelBtn.title.replace('⌘H', '⌘Y');
}

// ---------- side panel: history / bookmarks / downloads ----------
function openPanel(view) {
  if (panelView === view && !els.panel.hidden) return closePanel();
  panelView = view;
  els.panel.hidden = false;
  els.panelBtn.classList.add('on');
  renderPanel();
}

function closePanel() {
  panelView = null;
  els.panel.hidden = true;
  els.panelBtn.classList.remove('on');
}

document.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => { panelView = b.dataset.panel; renderPanel(); }));
$('#panel-close').addEventListener('click', closePanel);
els.panelBtn.addEventListener('click', () => (els.panel.hidden ? openPanel(panelView || 'history') : closePanel()));
els.downloadsBtn.addEventListener('click', () => openPanel('downloads'));

function openFromPanel(url, e) {
  if (e.button === 1 || e.ctrlKey) createTab(url, { background: true, index: tabs.indexOf(active) + 1 });
  else load(active, url);
}

function emptyState(text) {
  return h('div', { class: 'empty' }, h('img', { src: brand().logo, alt: '' }), text);
}

function dayLabel(time) {
  const d = new Date(time);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((today - new Date(d).setHours(0, 0, 0, 0)) / 864e5);
  if (diff === 0) return t('today');
  if (diff === 1) return t('yesterday');
  return d.toLocaleDateString(lang, { weekday: 'long', month: 'long', day: 'numeric' });
}

function renderPanel() {
  document.querySelectorAll('.seg button').forEach((b) => b.classList.toggle('on', b.dataset.panel === panelView));
  if (panelView === 'history') renderHistoryPanel();
  else if (panelView === 'bookmarks') renderBookmarksPanel();
  else if (panelView === 'downloads') renderDownloadsPanel();
  else if (panelView === 'passwords') renderPasswordsPanel();
}

function renderPasswordsPanel() {
  const list = h('div');
  const search = h('input', { class: 'field', placeholder: t('searchPasswords'), spellcheck: 'false' });
  const importBtn = h('button', { class: 'text-btn', text: t('importBtn'), onclick: openImport });
  const refresh = async () => {
    const items = await api.invoke('passwords:list', search.value);
    if (!items.length) {
      return list.replaceChildren(emptyState(search.value ? t('noMatches') : t('noPasswords')));
    }
    list.replaceChildren(...items.map((p) => {
      const sub = h('div', { class: 's', text: p.username || t('noUsername') });
      const showBtn = h('button', { text: t('show') });
      showBtn.addEventListener('click', async () => {
        if (sub.classList.contains('pw-secret')) {
          sub.textContent = p.username || t('noUsername');
          sub.classList.remove('pw-secret');
          showBtn.textContent = t('show');
        } else {
          sub.textContent = await api.invoke('passwords:reveal', p.id);
          sub.classList.add('pw-secret');
          showBtn.textContent = t('hide');
        }
      });
      const copy = (field, label) => h('button', {
        text: label,
        onclick: async () => { await api.invoke('passwords:copy', p.id, field); toast(t(field === 'username' ? 'usernameCopied' : 'passwordCopied')); }
      });
      return h('div', { class: 'row', title: p.origin },
        favicon(null, p.origin),
        h('div', { class: 'meta' },
          h('div', { class: 't', text: p.host }),
          sub,
          h('div', { class: 'dl-actions' },
            copy('username', t('copyUsername')), copy('password', t('copyPassword')), showBtn,
            h('button', {
              text: t('delete'),
              onclick: async () => {
                if (!confirm(t('confirmDeletePw', { who: p.username || p.host }))) return;
                await api.invoke('passwords:delete', p.id);
                refresh();
              }
            }))));
    }));
  };
  search.addEventListener('input', refresh);
  els.panelBody.replaceChildren(h('div', { class: 'panel-tools' }, search, importBtn), list);
  refresh();
}

// ---------- import from other browsers ----------
const modalBackdrop = $('#modal-backdrop');
const modal = $('#modal');

function closeModal() { modalBackdrop.hidden = true; modal.replaceChildren(); }
modalBackdrop.addEventListener('mousedown', (e) => { if (e.target === modalBackdrop) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modalBackdrop.hidden) closeModal(); });

function describeImport(r) {
  const parts = [];
  if (r.bookmarks != null) parts.push(t('countBookmarks', { n: r.bookmarks }));
  if (r.history != null) parts.push(t('countHistory', { n: r.history }));
  if (r.passwords != null) parts.push(t('countPasswords', { n: r.passwords }));
  return t('imported', { list: parts.join(', ') });
}

// Errors from the main process arrive as translation keys when it can.
const errorText = (e) => (I18N.strings.en[e] ? t(e) : e);

function afterImport(r) {
  if (r.allBookmarks) { bookmarks = r.allBookmarks; bookmarksChanged(); }
  if (panelView) renderPanel();
}

async function openImport() {
  hideFloating();
  const sources = await api.invoke('import:sources');
  const result = h('div', { class: 'result' });
  const show = (text, isError = false) => { result.textContent = text; result.classList.toggle('err', isError); };
  const box = (label, checked = true) => {
    const input = h('input', { type: 'checkbox', checked });
    return { input, el: h('label', {}, input, label) };
  };
  const wantBookmarks = box(t('bookmarks'));
  const wantHistory = box(t('history'));
  const wantPasswords = box(t('passwords'));

  const select = h('select', { class: 'field' }, ...sources.map((s) => h('option', { value: s.id, text: s.label })));
  const runBtn = h('button', { class: 'btn', text: t('importBtn') });
  runBtn.addEventListener('click', async () => {
    const want = { bookmarks: wantBookmarks.input.checked, history: wantHistory.input.checked, passwords: wantPasswords.input.checked };
    if (!want.bookmarks && !want.history && !want.passwords) return show(t('pickOne'), true);
    runBtn.disabled = true;
    runBtn.textContent = t('importing');
    try {
      const r = await api.invoke('import:run', select.value, want);
      if (r.error) return show(errorText(r.error), true);
      let text = describeImport({
        bookmarks: want.bookmarks ? r.bookmarks : null,
        history: want.history ? r.history : null,
        passwords: want.passwords ? r.passwords : null
      });
      if (r.skippedPasswords) text += ' ' + t('skippedPw', { n: r.skippedPasswords });
      if (r.passwordsUnsupported) text += ' ' + t('firefoxPw');
      show(text);
      afterImport(r);
    } catch (e) {
      show(t('importFailed', { msg: e.message }), true);
    } finally {
      runBtn.disabled = false;
      runBtn.textContent = t('importBtn');
    }
  });

  const fromFile = (kind, label) => h('button', {
    class: 'btn ghost', text: label,
    onclick: async () => {
      const r = await api.invoke('import:file', kind);
      if (r.canceled) return;
      if (r.error) return show(errorText(r.error), true);
      show(describeImport(r));
      afterImport(r);
    }
  });

  modal.replaceChildren(
    h('h2', { text: t('importTitle', { name: brand().name }) }),
    h('p', { class: 'sub', text: t('importSub') }),
    sources.length
      ? h('div', {},
        select,
        h('div', { class: 'checks' }, wantBookmarks.el, wantHistory.el, wantPasswords.el),
        h('div', { class: 'modal-row' }, runBtn))
      : h('p', { class: 'sub', text: t('importNoBrowsers') }),
    result,
    h('h3', { text: t('fromFile') }),
    h('div', { class: 'modal-row' },
      fromFile('passwords-csv', t('pwCsv')),
      fromFile('bookmarks-html', t('bmHtml'))),
    // On macOS Chrome's passwords import directly, so only the Firefox part of the hint applies.
    h('div', { class: 'hint', html: IS_MAC ? t('importHint').split('<br>').slice(1).join('<br>') : t('importHint') }),
    h('div', { class: 'modal-row end' }, h('button', { class: 'btn ghost', text: t('done'), onclick: closeModal }))
  );
  modalBackdrop.hidden = false;
}

function renderHistoryPanel() {
  const list = h('div');
  const search = h('input', { class: 'field', placeholder: t('searchHistory'), spellcheck: 'false' });
  const clear = h('button', { class: 'text-btn', text: t('clearAll') });
  const refresh = async () => {
    const items = await api.invoke('history:query', search.value);
    if (!items.length) return list.replaceChildren(emptyState(search.value ? t('noMatches') : t('nowhereFlown')));
    let last = '';
    const nodes = [];
    for (const it of items) {
      const label = dayLabel(it.time);
      if (label !== last) { nodes.push(h('div', { class: 'group-label', text: label })); last = label; }
      nodes.push(h('div', { class: 'row', title: it.url, onmouseup: (e) => { if (!e.target.closest('.x')) openFromPanel(it.url, e); } },
        favicon(it.favicon, it.url),
        h('div', { class: 'meta' },
          h('div', { class: 't', text: it.title || it.url }),
          h('div', { class: 's', text: `${new Date(it.time).toLocaleTimeString(lang, { hour: 'numeric', minute: '2-digit' })} · ${hostOf(it.url)}` })),
        h('button', {
          class: 'icon-btn small x', title: t('removeFromHistory'), html: ICON.close,
          onclick: async () => { await api.invoke('history:remove', it.id); refresh(); }
        })));
    }
    list.replaceChildren(...nodes);
  };
  search.addEventListener('input', refresh);
  clear.addEventListener('click', async () => {
    if (!confirm(t('confirmClearHistory'))) return;
    await api.invoke('history:clear');
    refresh();
    toast(t('historyCleared'));
  });
  els.panelBody.replaceChildren(h('div', { class: 'panel-tools' }, search, clear), list);
  refresh();
  search.focus();
}

function renderBookmarksPanel() {
  if (!bookmarks.length) return els.panelBody.replaceChildren(emptyState(t('noBookmarks')));
  els.panelBody.replaceChildren(...[...bookmarks].reverse().map((b) =>
    h('div', { class: 'row', title: b.url, onmouseup: (e) => { if (!e.target.closest('.x')) openFromPanel(b.url, e); } },
      favicon(b.favicon, b.url),
      h('div', { class: 'meta' }, h('div', { class: 't', text: b.title || b.url }), h('div', { class: 's', text: hostOf(b.url) })),
      h('button', { class: 'icon-btn small x', title: t('removeBookmark'), html: ICON.close, onclick: () => removeBookmark(b.url) }))));
}

function renderDownloadsPanel() {
  const items = [...downloads.values()].sort((a, b) => b.id - a.id);
  if (!items.length) return els.panelBody.replaceChildren(emptyState(t('noDownloads')));
  els.panelBody.replaceChildren(...items.map((d) => {
    const pct = d.total ? Math.round((d.received / d.total) * 100) : 0;
    const status = {
      progressing: d.total ? t('dlProgress', { a: formatBytes(d.received), b: formatBytes(d.total), p: pct }) : formatBytes(d.received),
      completed: t('dlDone', { size: formatBytes(d.total || d.received) }),
      cancelled: t('dlCancelled'),
      interrupted: t('dlFailed')
    }[d.state] || d.state;
    const actions = d.state === 'completed'
      ? [h('button', { text: t('open'), onclick: () => api.invoke('downloads:open', d.path) }),
         h('button', { text: t('showInFolder'), onclick: () => api.invoke('downloads:show', d.path) })]
      : d.state === 'progressing' ? [h('button', { text: t('cancel'), onclick: () => api.invoke('downloads:cancel', d.id) })] : [];
    return h('div', { class: 'row' },
      h('span', { class: 'fav', html: ICON.download }),
      h('div', { class: 'meta' },
        h('div', { class: 't', text: d.filename, title: d.path }),
        h('div', { class: 's', text: status }),
        d.state === 'progressing' ? h('div', { class: 'progress' }, h('i', { style: `width:${d.total ? pct : 30}%` })) : null,
        actions.length ? h('div', { class: 'dl-actions' }, ...actions) : null));
  }));
}

api.on('download', (d) => {
  const isNew = !downloads.has(d.id);
  downloads.set(d.id, d);
  els.downloadsBtn.hidden = false;
  const running = [...downloads.values()].filter((x) => x.state === 'progressing').length;
  const badge = els.downloadsBtn.querySelector('.badge');
  badge.hidden = !running;
  badge.textContent = running;
  if (isNew) {
    els.downloadsBtn.classList.remove('pulse');
    void els.downloadsBtn.offsetWidth;
    els.downloadsBtn.classList.add('pulse');
    toast(t('downloadingFile', { file: d.filename }));
  }
  if (d.state === 'completed') toast(t('downloadedFile', { file: d.filename }));
  if (panelView === 'downloads') renderDownloadsPanel();
});

// ---------- shortcuts & events from the main process ----------
function runShortcut(name) {
  if (name.startsWith('tab-')) {
    const n = Number(name.slice(4));
    return activate(n === 9 ? tabs[tabs.length - 1] : tabs[n - 1]);
  }
  const i = tabs.indexOf(active);
  switch (name) {
    case 'new-tab': return createTab();
    case 'close-tab': return closeTab(active);
    case 'reopen-tab': return reopenTab();
    case 'next-tab': return activate(tabs[(i + 1) % tabs.length]);
    case 'prev-tab': return activate(tabs[(i - 1 + tabs.length) % tabs.length]);
    case 'focus-address': return focusAddress();
    case 'reload': return reload();
    case 'hard-reload': return reload(true);
    case 'back': return goBack();
    case 'forward': return goForward();
    case 'home': return load(active, NEWTAB);
    case 'find': return openFind();
    case 'bookmark': return toggleBookmark();
    case 'history': return openPanel('history');
    case 'bookmarks': return openPanel('bookmarks');
    case 'downloads': return openPanel('downloads');
    case 'toggle-bookmarks-bar': return setSetting({ showBookmarksBar: !settings.showBookmarksBar });
    case 'devtools': return withView((wv) => (wv.isDevToolsOpened() ? wv.closeDevTools() : wv.openDevTools()));
    case 'print': return withView((wv) => wv.print());
    case 'view-source': return isNewTab(active.url) ? null : createTab('view-source:' + active.url, { index: i + 1 });
    case 'zoom-in': return zoom(1);
    case 'zoom-out': return zoom(-1);
    case 'zoom-reset': return zoom(0);
  }
}

api.on('shortcut', runShortcut);
api.on('open-tab', ({ url, background }) => createTab(url, { background, index: tabs.indexOf(active) + 1 }));
api.on('navigate', (text) => navigate(text));
api.on('fullscreen', (on) => { if (!on) document.body.classList.remove('html-fs'); });

// ---------- start ----------
async function init() {
  document.body.classList.add('platform-' + api.platform);
  const state = await api.invoke('state:get');
  settings = state.settings;
  bookmarks = state.bookmarks;
  engines = state.engines;
  trackerCount = state.trackerCount;
  discordStatus = await api.invoke('discord:status');
  updateState = await api.invoke('update:status');
  renderUpdate();
  applySettings();
  renderBookmarksBar();

  const saved = state.session?.tabs || [];
  if (saved.length) {
    for (const t of saved) createTab(t.url, { background: true, lazy: true, title: t.title });
    activate(tabs[Math.min(Math.max(state.session.active | 0, 0), tabs.length - 1)]);
  } else {
    createTab();
  }
}

init();
