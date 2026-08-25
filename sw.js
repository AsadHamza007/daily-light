const CACHE = 'daily-light-v10';
const ASSETS = ['./', './index.html', './native-alarm.js', './manifest.json', './icon-192.png', './icon-512.png'];
const HADITH_CDN = [
  'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/',
  'https://raw.githubusercontent.com/fawazahmed0/hadith-api/1/'
];
// Cache per-section hadith responses so already-read chapters work offline.
// Full-edition downloads are excluded — those live in IndexedDB via the app.
const isHadithSection = (url) =>
  HADITH_CDN.some((b) => url.startsWith(b)) && url.includes('/sections/');

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const isDoc = e.request.mode === 'navigate' || e.request.destination === 'document';

  if (isDoc) {
    // Network-first for the app itself: every open gets the latest version,
    // falls back to cache when offline.
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => { c.put('./index.html', copy); });
          }
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Everything else: cache-first with background refresh
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const network = fetch(e.request)
        .then((res) => {
          if (res.ok && (e.request.url.startsWith(self.location.origin) || isHadithSection(e.request.url))) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
