// Renders the iOS app icon (1024, opaque) and the pigeon/goose logos (1x/2x/3x)
// into ios/PigeonWeb/Assets.xcassets.
// Run: node_modules\electron\dist\electron.exe tools\render-ios-assets.js
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const assets = path.join(root, 'ios', 'PigeonWeb', 'Assets.xcassets');
app.setPath('userData', path.join(require('os').tmpdir(), 'pigeon-ios-render'));
setTimeout(() => { console.log('timeout'); app.exit(1); }, 60000);

const svgData = (name) => 'data:image/svg+xml;base64,' +
  fs.readFileSync(path.join(root, 'src', 'pages', `${name}.svg`)).toString('base64');

function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2));
}
function writePng(file, dataUrl) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
}

app.whenReady().then(async () => {
  try {
    const w = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
    await w.loadURL('data:text/html,<html><body></body></html>');
    const draw = (svg, size, icon) => w.webContents.executeJavaScript(`new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = c.height = ${size};
        const g = c.getContext('2d');
        if (${icon}) {
          const bg = g.createRadialGradient(${size * 0.3}, ${size * 0.22}, 0, ${size * 0.3}, ${size * 0.22}, ${size * 1.05});
          bg.addColorStop(0, '#8b7cff'); bg.addColorStop(0.4, '#4b3fb0'); bg.addColorStop(0.75, '#1f1b44'); bg.addColorStop(1, '#121320');
          g.fillStyle = bg; g.fillRect(0, 0, ${size}, ${size});
          g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = ${size * 0.04}; g.shadowOffsetY = ${size * 0.03};
          g.drawImage(img, ${size * 0.17}, ${size * 0.18}, ${size * 0.66}, ${size * 0.66});
        } else {
          g.drawImage(img, 0, 0, ${size}, ${size});
        }
        resolve(c.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('svg failed to load'));
      img.src = ${JSON.stringify(svg)};
    })`);

    writePng(path.join(assets, 'AppIcon.appiconset', 'icon.png'), await draw(svgData('pigeon'), 1024, true));
    writeJson(path.join(assets, 'AppIcon.appiconset', 'Contents.json'), {
      images: [{ filename: 'icon.png', idiom: 'universal', platform: 'ios', size: '1024x1024' }],
      info: { author: 'xcode', version: 1 }
    });
    for (const [name, set] of [['pigeon', 'Pigeon'], ['goose', 'Goose']]) {
      const images = [];
      for (const scale of [1, 2, 3]) {
        const file = `${name}@${scale}x.png`;
        writePng(path.join(assets, `${set}.imageset`, file), await draw(svgData(name), 120 * scale, false));
        images.push({ filename: file, idiom: 'universal', scale: `${scale}x` });
      }
      writeJson(path.join(assets, `${set}.imageset`, 'Contents.json'), { images, info: { author: 'xcode', version: 1 } });
    }
    writeJson(path.join(assets, 'Contents.json'), { info: { author: 'xcode', version: 1 } });
    console.log('ios assets rendered');
    app.exit(0);
  } catch (e) {
    console.log('render error', e.message);
    app.exit(1);
  }
});
