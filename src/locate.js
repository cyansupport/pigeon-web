// Finds roughly where the user is, for the weather widget. Precise coordinates come from
// Windows Location Services (or the Mac's Location Services, read by the new tab page and
// passed in as `hint`); when those are off or unavailable we fall back to an IP lookup,
// which is usually right to the city.
const { execFile } = require('child_process');
const { net } = require('electron');

const CACHE_MS = 20 * 60e3;
let cache = null;

const valid = (lat, lon) => Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;

async function getJson(url) {
  const res = await net.fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error('network');
  return res.json();
}

// GeoCoordinateWatcher talks to Windows Location Services. It reports "Disabled" straight
// away when location is turned off for desktop apps, so this only waits when it's working.
function windowsPosition() {
  const script = [
    'Add-Type -AssemblyName System.Device',
    '$w = New-Object System.Device.Location.GeoCoordinateWatcher',
    '$w.Start()',
    '$n = 0; while ($w.Status -ne "Ready" -and $w.Status -ne "Disabled" -and $n -lt 70) { Start-Sleep -Milliseconds 100; $n++ }',
    '$c = $w.Position.Location',
    'if ($w.Status -ne "Ready" -or $c.IsUnknown) { exit 1 }',
    '$inv = [Globalization.CultureInfo]::InvariantCulture',
    '$c.Latitude.ToString($inv) + "," + $c.Longitude.ToString($inv)'
  ].join('; ');
  return new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script],
      { windowsHide: true, timeout: 10000 }, (err, stdout) => {
        const [lat, lon] = String(stdout || '').trim().split(',').map(Number);
        resolve(!err && valid(lat, lon) ? { lat, lon } : null);
      });
  });
}

async function cityName(lat, lon, lang) {
  try {
    const r = await getJson(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=${encodeURIComponent(lang)}`);
    return r.city || r.locality || r.principalSubdivision || '';
  } catch { return ''; }
}

async function ipPosition() {
  try {
    const r = await getJson('https://get.geojs.io/v1/ip/geo.json');
    const lat = Number(r.latitude), lon = Number(r.longitude);
    if (valid(lat, lon)) return { lat, lon, city: r.city || '' };
  } catch { /* try the next service */ }
  const r = await getJson('https://ipwho.is/');
  const lat = Number(r.latitude), lon = Number(r.longitude);
  if (r.success === false || !valid(lat, lon)) throw new Error('network');
  return { lat, lon, city: r.city || '' };
}

async function locate({ lang = 'en', hint = null } = {}) {
  if (cache && cache.lang === lang && Date.now() - cache.at < CACHE_MS && !hint) return cache.place;
  let place = null;
  let precise = hint && valid(hint.lat, hint.lon) ? { lat: hint.lat, lon: hint.lon } : null;
  if (!precise && process.platform === 'win32') precise = await windowsPosition();
  if (precise) {
    place = { ...precise, city: await cityName(precise.lat, precise.lon, lang), precise: true };
    if (!place.city) place.city = (await ipPosition().catch(() => ({}))).city || '';
  } else {
    place = { ...(await ipPosition()), precise: false };
  }
  place.lat = Math.round(place.lat * 1e4) / 1e4;
  place.lon = Math.round(place.lon * 1e4) / 1e4;
  cache = { at: Date.now(), lang, place };
  return place;
}

module.exports = { locate };
