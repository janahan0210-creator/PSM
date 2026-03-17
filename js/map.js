/* ================================================================
   map.js  –  Offline Marine Spatial Analyzer PWA
   Initialises the Leaflet map, loads the GeoJSON sample dataset,
   and exposes helper functions used by app.js.
   ================================================================ */

'use strict';

/* ── 1. Initialise the Leaflet map ──────────────────────────────
   The map is attached to the <div id="map"> element in index.html.
   Centre coordinates: Kuala Lumpur, Malaysia [lat, lng]
   ────────────────────────────────────────────────────────────── */
const map = L.map('map', {
  center: [3.1390, 101.6869],
  zoom: 12,
  zoomControl: true
});

/* ── 2. OpenStreetMap basemap tile layer ── */
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
}).addTo(map);

/* ── 3. Layer groups ────────────────────────────────────────────
   Keeping sample data and user-collected points in separate
   layer groups makes it easy to show/hide them independently.
   ────────────────────────────────────────────────────────────── */
const sampleLayer    = L.layerGroup().addTo(map);   // GeoJSON sample points
const collectedLayer = L.layerGroup().addTo(map);   // User-added points

/* ── 4. Custom marker icons ─────────────────────────────────────
   Using L.divIcon so no external image files are required.
   ────────────────────────────────────────────────────────────── */

/**
 * Green teardrop icon – used for sample GeoJSON points.
 */
const sampleIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:22px; height:22px;
    background:#2c7a4b;
    border:3px solid #fff;
    border-radius:50% 50% 50% 0;
    transform:rotate(-45deg);
    box-shadow:0 2px 6px rgba(0,0,0,0.35);
  "></div>`,
  iconSize:    [22, 22],
  iconAnchor:  [11, 22],
  popupAnchor: [0, -26]
});

/**
 * Orange pulsing dot icon – used for user-collected points.
 * The CSS animation is defined in style.css (.marker-pulse).
 */
const collectedIcon = L.divIcon({
  className: '',
  html: `<div class="marker-pulse"></div>`,
  iconSize:    [14, 14],
  iconAnchor:  [7, 7],
  popupAnchor: [0, -12]
});

/* ── 5. Load sample GeoJSON data ────────────────────────────────
   Fetches data/sample-data.geojson and adds each feature to the
   sampleLayer as a marker with a popup.
   ────────────────────────────────────────────────────────────── */
function loadSampleData() {
  fetch('./data/sample-data.geojson')
    .then((response) => {
      if (!response.ok) {
        throw new Error('HTTP ' + response.status);
      }
      return response.json();
    })
    .then((geojson) => {
      // Use Leaflet's built-in GeoJSON layer for clean parsing
      L.geoJSON(geojson, {

        // Replace the default marker with our custom sampleIcon
        pointToLayer: (feature, latlng) => {
          return L.marker(latlng, { icon: sampleIcon });
        },

        // Bind a popup to each feature using its properties
        onEachFeature: (feature, layer) => {
          const p = feature.properties;
          layer.bindPopup(`
            <div class="popup-title">${p.name}</div>
            <div class="popup-meta">
              <span>📝 ${p.description}</span>
              <span>🏷️ ${p.category}</span>
              <span>👤 ${p.surveyed_by}</span>
              <span>📅 ${p.date_collected}</span>
              <span>🗒️ ${p.notes}</span>
            </div>
          `);
        }

      }).addTo(sampleLayer);

      // Update the status bar via a custom DOM event
      document.dispatchEvent(
        new CustomEvent('gis:status', {
          detail: `✅ ${geojson.features.length} sample point(s) loaded`
        })
      );

      console.log('[Map] Sample GeoJSON loaded:', geojson.features.length, 'features');
    })
    .catch((err) => {
      console.error('[Map] Failed to load sample-data.geojson:', err);
      document.dispatchEvent(
        new CustomEvent('gis:status', { detail: '⚠️ Could not load sample data.' })
      );
    });
}

/* ── 6. Add a collected point to the map ────────────────────────
   Called by app.js when the user clicks the map in "add" mode
   or when loading saved points from IndexedDB.

   @param {number} lat
   @param {number} lng
   @param {Object} properties  – { name, notes, timestamp }
   @returns {L.Marker}  – the created marker (so app.js can track it)
   ────────────────────────────────────────────────────────────── */
function addCollectedMarker(lat, lng, properties) {
  const marker = L.marker([lat, lng], { icon: collectedIcon });

  marker.bindPopup(`
    <div class="popup-title">${properties.name || 'Collected Point'}</div>
    <div class="popup-meta">
      <span>🗒️ ${properties.notes || '—'}</span>
      <span>📅 ${properties.timestamp || ''}</span>
      <span>📌 ${lat.toFixed(5)}, ${lng.toFixed(5)}</span>
    </div>
  `);

  marker.addTo(collectedLayer);
  return marker;
}

/* ── 7. Clear all collected markers from the map ── */
function clearCollectedMarkers() {
  collectedLayer.clearLayers();
}

/* ── 8. Load sample data on startup ── */
loadSampleData();
