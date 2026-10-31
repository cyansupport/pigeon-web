# Pigeon Web store

Widgets and wallpapers for the new tab page (✏️ Customize). The app downloads
them from this folder on GitHub:

`https://raw.githubusercontent.com/cyansupport/pigeon-web/main/store/`

- `index.json` — the catalog: names, sizes and SHA-256 checksums. The app refuses
  any download whose checksum doesn't match.
- `widgets/<id>/widget.html` — one self-contained HTML file per widget. Widgets run
  sandboxed and talk to the page only through `postMessage`
  (`ready` → receives `init` with `config`, `lang`, `theme`, `accent`; `save` stores config).
- `wallpapers/<id>.jpg` + `<id>-thumb.jpg` — 4K image and store preview.

## Adding or changing an item

1. Add/edit the files here (wallpapers can be re-rendered with
   `node_modules\electron\dist\electron.exe tools\render-wallpapers.js`).
2. Add its name/description to `tools/build-store.js`.
3. Run `node tools/build-store.js` to refresh `index.json`.
4. Upload the changed files to the `store/` folder on GitHub.

Users see new items the next time they open Customize — no app update needed.
