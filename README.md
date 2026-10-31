# 🐦 Pigeon Web

A fast, private browser built on Chromium (via Electron).

## Run

Double-click **Start Pigeon Web.cmd**, or:

```
npm install
npm start
```

Build a Windows installer into `dist/`: `npm run dist`
(NSIS can't handle very long paths, so build from a short folder such as `C:\pigeon-web`.)

## Features

- Tabs: drag to reorder, middle-click to close, reopen closed tabs, restored on next launch
- Smart address bar: search or URL, with suggestions from your history and bookmarks
- Bookmarks bar, history and downloads side panel
- Your own new-tab shortcuts (add with **+**, remove with ×)
- New-tab widgets & wallpapers from the online store (✏️ Customize) — see `store/README.md`
- Import bookmarks, history and passwords from Chrome, Edge, Brave, Opera, Vivaldi and Firefox
  (⋮ → Import from another browser…). Chrome/Firefox passwords come in via their CSV export.
- Built-in password manager: encrypted with Windows' own protection, fills logins automatically
- Built-in tracker & ad blocker with a per-page counter
- Permission prompts for camera, mic, location, notifications
- Find in page, zoom, print, dev tools, page right-click menu, spellcheck
- Choice of search engine: Google, DuckDuckGo, Bing, Brave, Ecosia
- Light and dark theme following Windows
- 6 languages: English, Polski, Deutsch, Español, Français, Português (⋮ → Language; follows Windows by default).
  Translations live in `src/pages/i18n.js`; add a language by copying the `S.en` block.
- Discord Rich Presence (off by default): turn on **Discord status** in the ⋮ menu; optionally show the current website

- Goose mode (off by default): turns the browser into **Goose Web** — goose logo, amber accent, honks

## Discord setup

The app ID is set in `src/discord.js`. In the Discord developer portal, under
**Rich Presence → Art Assets**, upload `build/icon.png` named `pigeon` and
`build/goose.png` named `goose` so the status shows the right picture.

## Releasing updates

Installed copies check GitHub Releases on startup and every 4 hours, download
new versions in the background, and show an **Update** button (or install on
next quit).

1. Bump `"version"` in `package.json` (e.g. `1.0.0` → `1.0.1`).
2. Create a GitHub token with `repo` scope and set it: `$env:GH_TOKEN = "ghp_..."`
3. From a short path (see above): `npm run release`

This uploads the installer, `latest.yml` and the blockmap to a GitHub release.

## Shortcuts

| Keys | Action |
| --- | --- |
| Ctrl+T / Ctrl+W | New / close tab |
| Ctrl+Shift+T | Reopen closed tab |
| Ctrl+Tab, Ctrl+1–9 | Switch tabs |
| Ctrl+L | Address bar |
| Ctrl+R / F5 | Reload |
| Alt+← / Alt+→ | Back / forward |
| Ctrl+D | Bookmark page |
| Ctrl+H / Ctrl+J | History / downloads |
| Ctrl+Shift+B | Toggle bookmarks bar |
| Ctrl+F | Find in page |
| Ctrl + / − / 0 | Zoom |
| F11 / F12 | Full screen / dev tools |

Data (bookmarks, history, session) is stored in `%APPDATA%\Pigeon Web\pigeon-data.json`.
