/* ============================================================
   service-worker.js  –  GIS Field Collector PWA
   Strategy : Cache-First with Network Fallback
   ============================================================ */

const CACHE_NAME    = 'gis-pwa-v1';
const OFFLINE_PAGE  = './index.html';

/* ── Assets to pre-cache on install ── */
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './sample-data.json',

  /* Leaflet CSS */
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',

  /* Leaflet JS */
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',

  /* Leaflet default marker images (needed for built-in icons) */
  'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
];

/* ════════════════════════════════════════════════════════════
   INSTALL  –  pre-cache all listed assets
════════════════════════════════════════════════════════════ */
self.addEventListener('install', event => {
  console.log('[SW] Install – pre-caching assets');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => {
        console.log('[SW] Pre-cache complete');
        return self.skipWaiting();   // activate immediately
      })
      .catch(err => console.error('[SW] Pre-cache failed:', err))
  );
});

/* ════════════════════════════════════════════════════════════
   ACTIVATE  –  remove stale caches from previous versions
════════════════════════════════════════════════════════════ */
self.addEventListener('activate', event => {
  console.log('[SW] Activate – cleaning old caches');

  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => {
              console.log('[SW] Deleting old cache:', key);
              return caches.delete(key);
            })
        )
      )
      .then(() => self.clients.claim())   // take control of all open tabs
  );
});

/* ════════════════════════════════════════════════════════════
   FETCH  –  Cache-First strategy
   1. Return cached response if available.
   2. Otherwise fetch from network and cache the response.
   3. If both fail (offline + not cached), return index.html
      for navigation requests so the app shell still loads.
════════════════════════════════════════════════════════════ */
self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {

        /* ── Cache hit → return immediately ── */
        if (cachedResponse) {
          return cachedResponse;
        }

        /* ── Cache miss → try network ── */
        return fetch(event.request.clone())
          .then(networkResponse => {
            // Only cache valid responses
            if (
              !networkResponse ||
              networkResponse.status !== 200 ||
              networkResponse.type === 'error'
            ) {
              return networkResponse;
            }

            // Store a copy in the cache for next time
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => cache.put(event.request, responseToCache));

            return networkResponse;
          })
          .catch(() => {
            /* ── Network failed (offline) ── */
            // For navigation requests, serve the app shell
            if (event.request.mode === 'navigate') {
              return caches.match(OFFLINE_PAGE);
            }
            // For other requests, just fail gracefully
            return new Response('Offline – resource not cached.', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'text/plain' }
            });
          });
      })
  );
});
