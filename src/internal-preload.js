// Runs in every tab, but only exposes an API to Pigeon's own pigeon:// pages.
const { contextBridge, ipcRenderer } = require('electron');

if (location.protocol === 'pigeon:') {
  contextBridge.exposeInMainWorld('pigeon', {
    shortcuts: () => ipcRenderer.invoke('internal:shortcuts'),
    addShortcut: (s) => ipcRenderer.invoke('internal:shortcut-add', s),
    removeShortcut: (url) => ipcRenderer.invoke('internal:shortcut-remove', url),
    info: () => ipcRenderer.invoke('internal:info'),
    navigate: (text) => ipcRenderer.invoke('internal:navigate', text),
    addons: () => ipcRenderer.invoke('internal:addons'),
    store: (force) => ipcRenderer.invoke('internal:store', force),
    install: (kind, id) => ipcRenderer.invoke('internal:install', kind, id),
    uninstall: (kind, id) => ipcRenderer.invoke('internal:uninstall', kind, id),
    setLayout: (patch) => ipcRenderer.invoke('internal:layout', patch),
    widgetConfig: (id) => ipcRenderer.invoke('internal:widget-config', id),
    saveWidgetConfig: (id, config) => ipcRenderer.invoke('internal:widget-config-save', id, config),
    customWallpaper: () => ipcRenderer.invoke('internal:custom-wallpaper'),
    locate: (hint) => ipcRenderer.invoke('internal:locate', hint),
    onInstallProgress: (fn) => ipcRenderer.on('addon-progress', (_e, p) => fn(p))
  });
}

// Fill saved logins into password fields (the main process only returns
// logins saved for this page's own site).
if (location.protocol === 'https:' || location.hostname === 'localhost') {
  let creds = null;
  let timer = null;
  let observer = null;
  const filled = new WeakSet();
  const visible = (el) => el.getClientRects().length > 0;
  const setValue = (el, value) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const usernameFieldFor = (pw) => {
    const scope = pw.form || document;
    const before = [...scope.querySelectorAll('input')].filter((i) =>
      /^(text|email|tel)?$/i.test(i.getAttribute('type') || '') && visible(i) &&
      (i.compareDocumentPosition(pw) & Node.DOCUMENT_POSITION_FOLLOWING));
    return before[before.length - 1] || null;
  };

  const fill = async () => {
    timer = null;
    const fields = [...document.querySelectorAll('input[type=password]')].filter((p) =>
      visible(p) && !p.value && !filled.has(p) && p.autocomplete !== 'new-password');
    if (!fields.length) return;
    if (!creds) creds = await ipcRenderer.invoke('autofill:get');
    if (!creds.length) { observer?.disconnect(); return; }
    const login = creds[0];
    for (const pw of fields) {
      filled.add(pw);
      const user = usernameFieldFor(pw);
      if (user && !user.value && login.username) setValue(user, login.username);
      setValue(pw, login.password);
    }
  };
  const schedule = () => { if (!timer) timer = setTimeout(fill, 400); };

  window.addEventListener('DOMContentLoaded', () => {
    schedule();
    observer = new MutationObserver(schedule);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  });
}
