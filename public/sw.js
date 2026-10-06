// Service Worker for SPBC Church CMS Mini App (Network-First Strategy)
const CACHE_NAME = 'spbc-cms-shell-v7';

// Only cache truly static, rarely-changing assets (NOT app.js or index.html)
const STATIC_ASSETS = [
  '/vue.global.js',
  '/tailwind.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('SW cache prefetch notice:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('🧹 Purging outdated service worker cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never intercept API, auth, or diagnostic calls
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/ping')) {
    return;
  }

  // Always fetch app.js, index.html, and SW itself fresh from network — never serve stale
  const alwaysFresh = ['/app.js', '/index.html', '/sw.js', '/admin'];
  if (alwaysFresh.some(p => url.pathname === p || url.pathname.startsWith(p + '?'))) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Network-First for everything else, update cache on success
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
