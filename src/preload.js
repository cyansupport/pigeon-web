// Bridge for the browser chrome (tabs, toolbar, panels).
const { contextBridge, ipcRenderer } = require('electron');

const EVENTS = new Set(['shortcut', 'open-tab', 'navigate', 'blocked', 'download', 'fullscreen', 'discord-status', 'update']);

contextBridge.exposeInMainWorld('pigeon', {
  platform: process.platform,
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  on: (channel, fn) => {
    if (EVENTS.has(channel)) ipcRenderer.on(channel, (_e, ...args) => fn(...args));
  }
});
