// IdeaLab app: guarda la interfaz para abrir rápido; los datos siempre se piden en vivo.
const CACHE = 'idealab-v12';
const ARCHIVOS = ['./', './index.html', './map.js', './d3.min.js', './manifest.webmanifest', './icon-192.png', './icon-512.png', './jspdf.umd.min.js', './logo-3d.png', './three.min.js', './logo-tex.jpg'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS))); self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (u.origin !== location.origin || e.request.method !== 'GET') return; // datos de Google/Meta: siempre en vivo
  e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(CACHE).then((k) => k.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
});
