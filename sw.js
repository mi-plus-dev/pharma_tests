/* Service worker: приложение целиком работает без интернета.
   Чтобы выпустить обновление, увеличьте номер в CACHE (pharma-v1 -> pharma-v2). */
const CACHE = 'pharma-v104';
const FONTS = 'pharma-fonts-v1';   // шрифты лежат отдельно и переживают обновление приложения
const CORE = ['./', './index.html', './style.css', './theme-dark.css', './data.js', './app.js', './recipe-bot.js', './diag.js', './manifest.webmanifest', './icons/favicon.png', './icons/icon-192.png', './icons/icon-512.png', './icons/splash-icon.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png', './icons/cad.svg', './icons/book.svg', './icons/scis.svg', './icons/search.svg', './icons/clip.svg'];
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Unbounded:wght@400;600;800;900&family=Golos+Text:wght@400;500;600;800&family=Marck+Script&family=IBM+Plex+Sans+Condensed:wght@400;500;600&display=swap';   // тот же адрес, что в index.html
const FONT_SUBSETS = ['cyrillic', 'latin'];   // остальные начертания (латиница расширенная, вьетнамский и т. п.) приложению не нужны
const EXTRA_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== FONTS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Шрифты для работы без интернета: страница просит загрузить их заранее после первого запуска (на установку это не влияет)
self.addEventListener('message', e => {
  if(e.data === 'precache-fonts') e.waitUntil(precacheFonts().catch(() => {}));
});
async function precacheFonts(){
  const cache = await caches.open(FONTS);
  const marker = new Request(self.registration.scope + '__fonts-ready');
  if(await cache.match(marker)) return;
  const timeout = ms => new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms));
  const res = await Promise.race([fetch(FONT_CSS), timeout(12000)]);
  if(!res.ok) return;
  const css = await res.clone().text();
  const urls = new Set();
  for(const m of css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*\{[^}]*?url\(([^)]+)\)/g)){
    if(FONT_SUBSETS.includes(m[1])) urls.add(m[2].replace(/^['"]|['"]$/g, ''));
  }
  if(!urls.size) return;
  for(const u of urls){
    const f = await Promise.race([fetch(u), timeout(20000)]);
    if(!f.ok) return;   // неполный набор не помечаем готовым — повторим при следующем запуске
    await cache.put(u, f);
  }
  await cache.put(FONT_CSS, res);
  await cache.put(marker, new Response('1'));
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  const external = url.origin !== location.origin;
  if(external && !EXTRA_HOSTS.includes(url.hostname)) return;
  e.respondWith((async () => {
    const hit = await caches.match(req, {ignoreSearch: req.mode === 'navigate'});
    // кэш сразу, обновление в фоне (если есть сеть)
    const net = fetch(req).then(res => {
      // «непрозрачный» ответ нельзя проверить на ошибку: им не затираем уже сохранённый хороший ответ
      if(res && (res.ok || (res.type === 'opaque' && !hit))){
        const copy = res.clone();
        caches.open(external ? FONTS : CACHE).then(c => c.put(req, copy));
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
