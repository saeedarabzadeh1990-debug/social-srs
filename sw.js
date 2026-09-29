// Service Worker — کش کامل برنامه برای کار آفلاین.
// با هر انتشار جدید، VERSION را عوض کن تا کاربران نسخه‌ی تازه را بگیرند.
const VERSION = '2.0.0';
const CACHE = `social-srs-${VERSION}`;

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.svg',
  './css/app.css',
  './js/app.js',
  './js/srs.js',
  './js/store.js',
  './js/data.js',
  './js/packs.js',
  './js/util.js',
  './js/io.js',
  './js/platform.js',
  './js/views/home.js',
  './js/views/study.js',
  './js/views/browse.js',
  './js/views/stats.js',
  './js/views/settings.js',
  './js/views/editor.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
];

self.addEventListener('install', (e) => {
  // عمداً skipWaiting نمی‌زنیم؛ برنامه خودش بعد از تأیید کاربر درخواست می‌دهد.
  // cache:'reload' یعنی کش HTTP مرورگر را دور بزن؛ هاستینگ‌هایی مثل GitHub Pages فایل‌ها را
  // ۱۰ دقیقه کش می‌کنند و بدون این، نسخه‌ی جدید ممکن است فایل‌های قدیمی را ذخیره کند.
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(ASSETS.map((u) => c.add(new Request(u, { cache: 'reload' }))))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) {
      if (k.startsWith('social-srs-') && k !== CACHE) await caches.delete(k);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
  if (e.data === 'GET_VERSION') e.source && e.source.postMessage({ type: 'VERSION', version: VERSION });
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    } catch {
      if (req.mode === 'navigate') {
        const shell = await cache.match('./index.html');
        if (shell) return shell;
      }
      return Response.error();
    }
  })());
});
