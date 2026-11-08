// Service Worker for SPBC Church CMS Mini App (Offline PWA & Shell Caching)
const CACHE_NAME = 'spbc-cms-shell-v16';

// Cache app shell and core UI helpers for hospital & home visits offline
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
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
  // Ignore non-http/https schemes (e.g. chrome-extension://, moz-extension://)
  if (!event.request.url.startsWith('http')) {
    return;
  }

  // Only handle GET requests in service worker cache
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // Never intercept mutating API, auth, or diagnostic calls
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/ping')) {
    return;
  }

  // Network-First with Offline Fallback for app shell
  const isShellRequest = url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/admin';
  if (isShellRequest) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {});
          }
          return networkResponse;
        })
        .catch(async () => {
          const matched = await caches.match(event.request);
          if (matched) return matched;
          if (event.request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/admin' || url.pathname.endsWith('.html')) {
            return caches.match('/index.html');
          }
          return new Response('Offline: Resource not available', { status: 503, statusText: 'Service Unavailable' });
        })
    );
    return;
  }

  // Cache-First with Network fallback for static vendor scripts
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache).catch(() => {});
          }).catch(() => {});
        }
        return networkResponse;
      });
    }).catch(() => {
      // CRITICAL: Only return index.html for page navigation requests, NEVER for scripts or styles
      if (event.request.mode === 'navigate' || event.request.destination === 'document') {
        return caches.match('/index.html');
      }
      return new Response('', { status: 404, statusText: 'Not Found' });
    })
  );
});
