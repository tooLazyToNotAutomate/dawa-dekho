// Offline support: network first, fall back to the cached copy when there is no signal.
const CACHE = 'dd-v1';
const FILES = [
  './', 'index.html', 'clinic/', 'clinic/index.html', 'demo.html', 'manifest.webmanifest', 'clinic/manifest.webmanifest',
  'assets/css/app.css',
  'assets/js/config.js', 'assets/js/core.js', 'assets/js/data.js', 'assets/js/i18n.js', 'assets/js/icons.js', 'assets/js/patient.js', 'assets/js/clinic.js',
  'assets/icons/icon-192.png', 'assets/icons/icon-512.png', 'assets/icons/clinic-192.png',
  'assets/fonts/inter-latin-400-normal.woff2', 'assets/fonts/inter-latin-600-normal.woff2', 'assets/fonts/inter-latin-700-normal.woff2',
  'assets/fonts/noto-sans-telugu-telugu-400-normal.woff2', 'assets/fonts/noto-sans-telugu-telugu-600-normal.woff2', 'assets/fonts/noto-sans-telugu-telugu-700-normal.woff2',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(FILES.map((f) => c.add(f).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(
    fetch(r).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(r, copy)); } return res; })
      .catch(() => caches.match(r).then((m) => m || caches.match('index.html')))
  );
});
