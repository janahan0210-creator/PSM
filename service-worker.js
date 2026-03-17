/* ================================================================
   service-worker.js  –  Offline Marine Spatial Analyzer PWA
   Strategy: Cache-First with Network Fallback

   Lifecycle:
     install  → pre-cache all app shell assets
     activate → delete stale caches from old versions
     fetch    → serve from cache; fall back to network; cache new responses
================================================================ */

'use strict';

/* ── Cache name (auto version using timestamp for development) ── */
const CACHE_NAME = 'Offline Marine Spatial Analyzer-' + Date.now();

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

  /* Leaflet default marker images */
  'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
];

/* ════════════════════════════════════════════════════════════════
   INSTALL EVENT
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
        return self.skipWaiting();
      })
      .catch((err) => console.error('[SW] Pre-cache error:', err))
  );
});

/* ════════════════════════════════════════════════════════════════
   ACTIVATE EVENT
════════════════════════════════════════════════════════════════ */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating – cleaning up old caches…');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Activation complete');
        return self.clients.claim();
      })
  );
});

/* ════════════════════════════════════════════════════════════════
   FETCH EVENT – Cache-First Strategy
════════════════════════════════════════════════════════════════ */
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {

        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request.clone())
          .then((networkResponse) => {
            if (
              !networkResponse ||
              networkResponse.status !== 200 ||
              networkResponse.type === 'error'
            ) {
              return networkResponse;
            }

            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));

            return networkResponse;
          })
          .catch(() => {
            if (event.request.mode === 'navigate') {
              return caches.match('./index.html');
            }

            return new Response(
              JSON.stringify({ error: 'Offline – resource not available in cache.' }),
              {
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'application/json' }
              }
            );
          });
      })
  );
});
