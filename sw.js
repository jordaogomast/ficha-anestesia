// Service worker: guarda o "app shell" para funcionar offline (o reconhecimento de voz do Chrome ainda precisa de internet).
const VERSAO = 'ficha-anestesia-v1.1.2-administrativo-manual';
const ARQUIVOS = ['./', './index.html', './styles.css', './manifest.webmanifest', './vendor/jspdf.umd.min.js',
  './src/app.js', './src/parser.js', './src/drogas.js', './src/ficha.js', './src/grafico.js', './src/pdf.js', './src/voz.js', './src/exemplo.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  // stale-while-revalidate
  e.respondWith(caches.open(VERSAO).then(async (c) => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const rede = fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || rede;
  }));
});
