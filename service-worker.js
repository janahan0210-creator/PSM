/* ================================================================
   service-worker.js  –  GIS Field Collector PWA
   Strategy: Cache-First with Network Fallback

   Lifecycle:
     install  → pre-cache all app shell assets
     activate → delete stale caches from old versions
     fetch    → serve from cache; fall back to network; cache new responses
   ================================================================ */

'use strict';

/* ── Cache name (bump version string to force cache refresh) ── */
const CACHE_NAME = 'gis-field-collector-v1';

/* ── App shell: all files needed to run the app offline ── */
const PRECACHE_URLS = [
  /* Pages */
  './',
  './index.html',

  /* Styles */
  './css/style.css',

  /* Scripts */
  './js/storage.js',
  './js/map.js',
  './js/app.js',

  /* PWA manifest */
  './manifest.json',

  /* Sample GeoJSON data */
  './data/sample-data.geojson',

  /* Icons */
  './icons/icon-192.png',
  './icons/icon-512.png',

  /* Leaflet CSS & JS from CDN */
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',

  /* Leaflet default marker images (used internally by Leaflet) */
  'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
];

/* ════════════════════════════════════════════════════════════════
   INSTALL EVENT
   Pre-caches all app shell assets so the app can load offline
   immediately after the first visit.
════════════════════════════════════════════════════════════════ */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing – pre-caching app shell…');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching app shell assets');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => {
        console.log('[SW] Pre-cache complete');
        // Skip the waiting phase so the new SW activates immediately
        return self.skipWaiting();
      })
      .catch((err) => {
        // Log but don't crash – some CDN assets may fail in strict environments
        console.error('[SW] Pre-cache error:', err);
      })
  );
});

/* ════════════════════════════════════════════════════════════════
   ACTIVATE EVENT
   Removes caches that belong to older versions of the app.
   This prevents stale assets from being served after an update.
════════════════════════════════════════════════════════════════ */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating – cleaning up old caches…');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)   // keep only current cache
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Activation complete');
        // Take control of all open tabs immediately (no reload needed)
        return self.clients.claim();
      })
  );
});

/* ════════════════════════════════════════════════════════════════
   FETCH EVENT  –  Cache-First Strategy
   ──────────────────────────────────────────────────────────────
   Step 1: Check the cache → return immediately if found.
   Step 2: Cache miss → fetch from network → cache the response.
   Step 3: Network fails (offline) →
             • Navigation requests → serve index.html (app shell)
             • Other requests      → return a 503 plain-text response
════════════════════════════════════════════════════════════════ */
self.addEventListener('fetch', (event) => {

  // Only intercept GET requests (POST/PUT used for API calls should bypass SW)
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {

        /* ── Cache HIT: return the cached asset immediately ── */
        if (cachedResponse) {
          return cachedResponse;
        }

        /* ── Cache MISS: fetch from the network ── */
        return fetch(event.request.clone())
          .then((networkResponse) => {

            // Don't cache error responses or opaque responses from other origins
            // (opaque = cross-origin requests without CORS headers)
            if (
              !networkResponse ||
              networkResponse.status !== 200 ||
              networkResponse.type === 'error'
            ) {
              return networkResponse;
            }

            // Clone the response: one copy goes to the cache, one to the browser
            const responseToCache = networkResponse.clone();

            caches.open(CACHE_NAME)
              .then((cache) => cache.put(event.request, responseToCache));

            return networkResponse;
          })
          .catch(() => {
            /* ── Network FAILED (device is offline) ── */

            // For page navigations, serve the cached app shell
            if (event.request.mode === 'navigate') {
              return caches.match('./index.html');
            }

            // For other uncached resources, return a graceful error response
            return new Response(
              JSON.stringify({ error: 'Offline – resource not available in cache.' }),
              {
                status:  503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'application/json' }
              }
            );
          });
      })
  );
});
