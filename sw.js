const CACHE_NAME = 'yr-financas-v258-remember-month';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './styles.css?v=258',
  './app.js',
  './app.js?v=258',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-192.png?v=258',
  './icon-512.png?v=258'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html')))
  );
});
