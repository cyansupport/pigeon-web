// Builds store/index.json from the files in store/ (sizes + SHA-256 checksums).
// Run after adding or changing a widget or wallpaper: node tools/build-store.js
// Then upload the whole store/ folder to the GitHub repo.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STORE = path.join(__dirname, '..', 'store');

const WIDGETS = [
  { id: 'clock', icon: '🕒', w: 1, name: { en: 'Clock', pl: 'Zegar', de: 'Uhr', es: 'Reloj', fr: 'Horloge', pt: 'Relógio' },
    desc: { en: 'Big, clean time and date.', pl: 'Duża, czytelna godzina i data.', de: 'Große, klare Uhrzeit und Datum.', es: 'Hora y fecha grandes y claras.', fr: 'Heure et date en grand.', pt: 'Hora e data grandes e limpas.' } },
  { id: 'weather', icon: '⛅', w: 1, name: { en: 'Weather', pl: 'Pogoda', de: 'Wetter', es: 'Tiempo', fr: 'Météo', pt: 'Tempo' },
    desc: { en: 'Current weather and 3-day forecast for your city.', pl: 'Aktualna pogoda i prognoza na 3 dni dla Twojego miasta.', de: 'Aktuelles Wetter und 3-Tage-Vorhersage für deine Stadt.', es: 'El tiempo actual y la previsión de 3 días para tu ciudad.', fr: 'Météo actuelle et prévisions sur 3 jours pour votre ville.', pt: 'Tempo atual e previsão de 3 dias para sua cidade.' } },
  { id: 'notes', icon: '📝', w: 1, name: { en: 'Notes', pl: 'Notatki', de: 'Notizen', es: 'Notas', fr: 'Notes', pt: 'Notas' },
    desc: { en: 'A quick note that saves as you type.', pl: 'Szybka notatka zapisywana podczas pisania.', de: 'Eine schnelle Notiz, die beim Tippen speichert.', es: 'Una nota rápida que se guarda mientras escribes.', fr: 'Une note rapide enregistrée pendant la saisie.', pt: 'Uma nota rápida que salva enquanto você digita.' } },
  { id: 'todo', icon: '✅', w: 1, name: { en: 'To-do', pl: 'Do zrobienia', de: 'Aufgaben', es: 'Tareas', fr: 'À faire', pt: 'Tarefas' },
    desc: { en: 'A simple checklist for today.', pl: 'Prosta lista zadań na dziś.', de: 'Eine einfache Checkliste für heute.', es: 'Una lista sencilla para hoy.', fr: 'Une liste simple pour aujourd’hui.', pt: 'Uma lista simples para hoje.' } },
  { id: 'pomodoro', icon: '🍅', w: 1, name: { en: 'Focus timer', pl: 'Minutnik skupienia', de: 'Fokus-Timer', es: 'Temporizador', fr: 'Minuteur', pt: 'Timer de foco' },
    desc: { en: '25 minutes of focus, 5 minutes of break.', pl: '25 minut skupienia, 5 minut przerwy.', de: '25 Minuten Fokus, 5 Minuten Pause.', es: '25 minutos de concentración, 5 de descanso.', fr: '25 minutes de concentration, 5 de pause.', pt: '25 minutos de foco, 5 de pausa.' } },
  { id: 'calendar', icon: '📅', w: 1, name: { en: 'Calendar', pl: 'Kalendarz', de: 'Kalender', es: 'Calendario', fr: 'Calendrier', pt: 'Calendário' },
    desc: { en: 'This month at a glance.', pl: 'Bieżący miesiąc w skrócie.', de: 'Dieser Monat auf einen Blick.', es: 'Este mes de un vistazo.', fr: 'Ce mois-ci en un coup d’œil.', pt: 'Este mês num relance.' } }
];

const WALLPAPERS = [
  { id: 'aurora', name: { en: 'Aurora', pl: 'Zorza', de: 'Polarlicht', es: 'Aurora', fr: 'Aurore', pt: 'Aurora' } },
  { id: 'sunset-dunes', name: { en: 'Sunset dunes', pl: 'Wydmy o zachodzie', de: 'Dünen im Abendrot', es: 'Dunas al atardecer', fr: 'Dunes au couchant', pt: 'Dunas ao pôr do sol' } },
  { id: 'ocean', name: { en: 'Moonlit ocean', pl: 'Ocean w blasku księżyca', de: 'Mondscheinmeer', es: 'Océano a la luz de la luna', fr: 'Océan au clair de lune', pt: 'Oceano ao luar' } },
  { id: 'pigeon-sky', name: { en: 'Pigeon sky', pl: 'Gołębie niebo', de: 'Taubenhimmel', es: 'Cielo de palomas', fr: 'Ciel de pigeons', pt: 'Céu de pombos' } },
  { id: 'neon-grid', name: { en: 'Neon grid', pl: 'Neonowa siatka', de: 'Neon-Raster', es: 'Rejilla de neón', fr: 'Grille néon', pt: 'Grade neon' } },
  { id: 'night-mountains', name: { en: 'Night mountains', pl: 'Góry nocą', de: 'Berge bei Nacht', es: 'Montañas de noche', fr: 'Montagnes la nuit', pt: 'Montanhas à noite' } },
  { id: 'misty-forest', name: { en: 'Misty forest', pl: 'Mglisty las', de: 'Nebelwald', es: 'Bosque brumoso', fr: 'Forêt brumeuse', pt: 'Floresta enevoada' } }
];

function fileInfo(rel) {
  const buf = fs.readFileSync(path.join(STORE, rel));
  return { file: rel, size: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex') };
}

const index = {
  version: 1,
  updated: new Date().toISOString(),
  widgets: WIDGETS.map((w) => ({ ...w, version: '1.0.0', ...fileInfo(`widgets/${w.id}/widget.html`) })),
  wallpapers: WALLPAPERS.map((w) => ({ ...w, ...fileInfo(`wallpapers/${w.id}.jpg`), thumb: `wallpapers/${w.id}-thumb.jpg` }))
};

fs.writeFileSync(path.join(STORE, 'index.json'), JSON.stringify(index, null, 2));
const kb = (n) => (n / 1024).toFixed(1) + ' KB';
for (const w of index.widgets) console.log('widget   ', w.id.padEnd(16), kb(w.size));
for (const w of index.wallpapers) console.log('wallpaper', w.id.padEnd(16), kb(w.size));
