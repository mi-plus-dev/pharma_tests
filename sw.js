/* Service worker: приложение целиком работает без интернета.
   Чтобы выпустить обновление, увеличьте номер в CACHE (pharma-v1 -> pharma-v2). */
const CACHE = 'pharma-v9';
const CORE = ['./', './index.html', './data.js', './manifest.webmanifest', './icons/favicon.png', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png', './icons/cad.svg', './icons/book.svg', './icons/scis.svg', './icons/search.svg', './icons/clip.svg'];
const EXTRA_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin !== location.origin && !EXTRA_HOSTS.includes(url.hostname)) return;
  e.respondWith((async () => {
    const hit = await caches.match(req, {ignoreSearch: req.mode === 'navigate'});
    // кэш сразу, обновление в фоне (если есть сеть)
    const net = fetch(req).then(res => {
      if(res && (res.ok || res.type === 'opaque')){
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => null);
    if(hit){ e.waitUntil(net); return hit; }
    const res = await net;
    if(res) return res;
    if(req.mode === 'navigate') return (await caches.match('./index.html')) || Response.error();
    return Response.error();
  })());
});
