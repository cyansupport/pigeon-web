// Renders the store wallpapers (4K JPEG + thumbnail) into store/wallpapers/.
// Run: node_modules\electron\dist\electron.exe tools\render-wallpapers.js
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'store', 'wallpapers');
app.setPath('userData', path.join(require('os').tmpdir(), 'pigeon-wallpaper-render'));

app.whenReady().then(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  await win.loadFile(path.join(__dirname, 'render-wallpapers.html'));
  const names = await win.webContents.executeJavaScript('names');
  for (const [i, name] of names.entries()) {
    const save = async (file, w, h, quality) => {
      const url = await win.webContents.executeJavaScript(
        `render(${JSON.stringify(name)}, ${w}, ${h}, ${1000 + i}).toDataURL('image/jpeg', ${quality})`);
      fs.writeFileSync(path.join(OUT, file), Buffer.from(url.split(',')[1], 'base64'));
    };
    await save(`${name}.jpg`, 3840, 2160, 0.9);
    await save(`${name}-thumb.jpg`, 480, 270, 0.82);
    console.log('rendered', name);
  }
  app.exit(0);
});
