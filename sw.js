/* Service worker: приложение целиком работает без интернета.
   Чтобы выпустить обновление, увеличьте номер в CACHE (pharma-v1 -> pharma-v2). */
const CACHE = 'pharma-v125';
const CORE = ['./', './index.html', './style.css', './theme-dark.css', './data.js', './app.js', './recipe-bot.js', './diag.js', './manifest.webmanifest', './icons/favicon.png', './icons/icon-192.png', './icons/icon-512.png', './icons/splash-icon.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png', './icons/cad.svg', './icons/book.svg', './icons/scis.svg', './icons/search.svg', './icons/clip.svg',
  './fonts/fonts.css',
  './fonts/golos-text-cyrillic-ext.woff2',
  './fonts/golos-text-cyrillic.woff2',
  './fonts/golos-text-latin-ext.woff2',
  './fonts/golos-text-latin.woff2',
  './fonts/ibm-plex-sans-condensed-400.woff2',
  './fonts/ibm-plex-sans-condensed-500.woff2',
  './fonts/ibm-plex-sans-condensed-600.woff2',
  './fonts/marck-script-cyrillic.woff2',
  './fonts/marck-script-latin-ext.woff2',
  './fonts/marck-script-latin.woff2',
  './fonts/unbounded-cyrillic-ext.woff2',
  './fonts/unbounded-cyrillic.woff2',
  './fonts/unbounded-latin-ext.woff2',
  './fonts/unbounded-latin.woff2',
  './fonts/unbounded-vietnamese.woff2'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k === 'pharma-fonts-v1' || (/^pharma-v\d+$/.test(k) && k !== CACHE)).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  if(new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, {ignoreSearch: true});
    if(hit) return hit;
    try{
      return await fetch(req);
    }catch{
      if(req.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
      return Response.error();
    }
  })());
});
