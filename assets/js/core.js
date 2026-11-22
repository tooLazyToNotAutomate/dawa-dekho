// Shared core: data store (localStorage, live-synced across windows), helpers, tiny renderer.
import { ICONS } from './icons.js';
import { APP } from './config.js';
import { makeSeed, dateStr } from './data.js';

/* ---------- data store ---------- */
// The prototype keeps its data in the browser (localStorage). Two windows on the same
// device/browser stay in sync through the "storage" event. To go multi-device later,
// replace load/save/update below with a cloud database (see README).
const KEY = 'dd.data.v1';
let data = null;
const listeners = new Set();

function readStore() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    return d && d.v === 1 ? d : null;
  } catch { return null; }
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* private mode: stay in memory */ } }
const emit = () => listeners.forEach((fn) => fn());

export function load() { data = readStore(); if (!data) { data = makeSeed(); save(); } return data; }
export const db = () => data;
export const onChange = (fn) => listeners.add(fn);
export function update(fn) { fn(data); save(); emit(); }
export function resetData() { data = makeSeed(); save(); emit(); }
window.addEventListener('storage', (e) => { if (e.key === KEY || e.key === null) { load(); emit(); } });

/* ---------- per-app preferences (language, chosen clinic, profile, login) ---------- */
export function prefs(ns) {
  const k = 'dd.pref.' + ns;
  const read = () => { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch { return {}; } };
  return {
    get: (n, d) => (read()[n] ?? d),
    set: (n, v) => { const o = read(); o[n] = v; try { localStorage.setItem(k, JSON.stringify(o)); } catch { /* ignore */ } },
    del: (n) => { const o = read(); delete o[n]; try { localStorage.setItem(k, JSON.stringify(o)); } catch { /* ignore */ } },
  };
}

/* ---------- small helpers ---------- */
export const uid = (p) => p + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const todayStr = () => dateStr(0);
export { dateStr };
export const isPhone = (s) => /^[6-9]\d{9}$/.test(String(s).trim());

export function icon(name, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

const loc = (lang) => (lang === 'te' ? 'te-IN' : 'en-IN');
export function fmtDate(ds, lang, opts = { weekday: 'short', day: 'numeric', month: 'short' }) {
  return new Date(ds + 'T00:00').toLocaleDateString(loc(lang), opts);
}
export function fmtTime(hhmm, lang) {
  const [h, m] = hhmm.split(':').map(Number);
  const s = new Date(2000, 0, 1, h, m).toLocaleTimeString(loc(lang), { hour: 'numeric', minute: '2-digit' });
  return lang === 'te' ? s : s.toUpperCase();
}
// i = 0 (Sunday) .. 6 (Saturday)
export function weekday(i, lang, style = 'short') {
  return new Date(2023, 0, 1 + i).toLocaleDateString(loc(lang), { weekday: style });
}
export function timeAgo(ts, t) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return t('ago.now');
  if (m < 60) return t('ago.min', { n: m });
  const h = Math.round(m / 60);
  if (h < 24) return t('ago.hr', { n: h });
  return t('ago.day', { n: Math.round(h / 24) });
}

export const clinicName = (c, lang) => (lang === 'te' && c.nameTe ? c.nameTe : c.name);
export const clinicArea = (c, lang) => (lang === 'te' && c.areaTe ? c.areaTe : c.area);
export const mapsUrl = (c) => c.mapsLink || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address)}`;

// What patients should see for a clinic right now.
export function clinicState(c) {
  const stale = Date.now() - c.statusUpdatedAt > APP.staleHours * 3600 * 1000;
  if (stale) return { level: 'stale', k: 'stale' };
  if (!c.isOpen) return { level: 'bad', k: 'closed' };
  if (!c.doctor) return { level: 'warn', k: 'nodoc' };
  return { level: 'good', k: 'open' };
}

export function stockCounts(c) {
  const r = { in: 0, low: 0, out: 0 };
  for (const v of Object.values(c.stock)) r[v] = (r[v] || 0) + 1;
  return r;
}

// 30-minute appointment slots for a clinic on a date.
export function slotsFor(clinic, ds) {
  const d = new Date(ds + 'T00:00');
  if (clinic.closedDays.includes(d.getDay())) return [];
  const [oh, om] = clinic.open.split(':').map(Number);
  const [ch, cm] = clinic.close.split(':').map(Number);
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const out = [];
  for (let m = oh * 60 + om; m + 30 <= ch * 60 + cm; m += 30) {
    const time = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    const taken = db().appointments.filter((a) => a.clinicId === clinic.id && a.date === ds && a.time === time && a.status !== 'cancelled').length;
    out.push({ time, left: Math.max(0, APP.slotCapacity - taken), past: ds === todayStr() && m <= nowMin });
  }
  return out;
}

/* ---------- tiny UI runtime: render + event delegation + drafts ---------- */
export const draft = {}; // text typed into inputs, keyed by data-draft, survives re-renders
export const val = (k) => esc(draft[k] ?? '');

export function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('toast--in'));
  setTimeout(() => { el.classList.remove('toast--in'); setTimeout(() => el.remove(), 300); }, 2400);
}

// build(): returns HTML string. actions: { name(dataset, element) }.
export function mount(root, build, actions) {
  let pending = false;
  function render() {
    const a = document.activeElement;
    let key = null, s = 0, e = 0;
    if (a && root.contains(a) && a.dataset && a.dataset.draft) {
      key = a.dataset.draft; s = a.selectionStart; e = a.selectionEnd;
    }
    const y = window.scrollY;
    root.innerHTML = build();
    window.scrollTo(0, y);
    if (key) {
      const n = root.querySelector(`[data-draft="${CSS.escape(key)}"]`);
      if (n) { n.focus(); try { n.setSelectionRange(s, e); } catch { /* not a text input */ } }
    }
    pending = false;
  }
  // Data changed elsewhere: don't disturb someone who is typing.
  function soft() {
    const a = document.activeElement;
    if (a && root.contains(a) && a.dataset && a.dataset.draft) pending = true; else render();
  }
  root.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-act]');
    if (!el || !root.contains(el)) return;
    const fn = actions[el.dataset.act];
    if (fn) { ev.preventDefault(); fn(el.dataset, el); }
  });
  root.addEventListener('input', (ev) => {
    const k = ev.target.dataset && ev.target.dataset.draft;
    if (!k) return;
    draft[k] = ev.target.value;
    if (ev.target.dataset.live !== undefined) render(); // e.g. search boxes filter as you type
  });
  root.addEventListener('focusout', () => { if (pending) setTimeout(() => { const a = document.activeElement; if (!(a && root.contains(a) && a.dataset && a.dataset.draft)) render(); }, 50); });
  return { render, soft };
}
