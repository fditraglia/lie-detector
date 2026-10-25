// Serve from the cache immediately and refresh it in the background, so the
// page loads instantly on a slow classroom connection and still works offline.
const CACHE = 'lie-detector-v1';
const ASSETS = ['./', 'index.html', 'style.css', 'app.js', 'img/ninja.png', 'img/angel.png', 'img/LICENSE-fluent-emoji.txt'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(event.request, { ignoreSearch: true });
      const fresh = fetch(event.request)
        .then(response => {
          if (response.ok) cache.put(event.request, response.clone());
          return response;
        })
        .catch(() => cached);
      return cached || fresh;
    })
  );
});
