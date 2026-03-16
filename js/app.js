/* ================================================================
   app.js  –  GIS Field Collector PWA
   Main application controller.

   Responsibilities:
     • Register the Service Worker
     • Monitor online / offline status
     • Wire up toolbar buttons (Add Location, Save Data, View Offline)
     • Coordinate between map.js (UI) and storage.js (persistence)
   ================================================================ */

'use strict';

/* ════════════════════════════════════════════════════════════════
   1. SERVICE WORKER REGISTRATION
   Registers service-worker.js so the app can work offline.
   The SW is only registered after the page has fully loaded.
════════════════════════════════════════════════════════════════ */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./service-worker.js')
      .then((reg) => {
        console.log('[App] Service Worker registered. Scope:', reg.scope);
      })
      .catch((err) => {
        console.error('[App] Service Worker registration failed:', err);
      });
  });
} else {
  console.warn('[App] Service Workers are not supported in this browser.');
}

/* ════════════════════════════════════════════════════════════════
   2. DOM REFERENCES
════════════════════════════════════════════════════════════════ */
const statusBadge    = document.getElementById('status-badge');
const statusBar      = document.getElementById('status-bar');
const mapEl          = document.getElementById('map');
const btnAddLocation = document.getElementById('btn-add-location');
const btnSaveData    = document.getElementById('btn-save-data');
const btnViewOffline = document.getElementById('btn-view-offline');

/* ════════════════════════════════════════════════════════════════
   3. STATUS BAR HELPER
   Listens for the custom 'gis:status' event dispatched by map.js
   and also provides a direct setStatus() function for app.js use.
════════════════════════════════════════════════════════════════ */

/**
 * Updates the bottom status bar text.
 * @param {string} message
 */
function setStatus(message) {
  statusBar.textContent = message;
}

// Listen for status events fired by map.js
document.addEventListener('gis:status', (e) => setStatus(e.detail));

/* ════════════════════════════════════════════════════════════════
   4. ONLINE / OFFLINE INDICATOR
   Updates the header badge whenever connectivity changes.
════════════════════════════════════════════════════════════════ */
function updateNetworkStatus() {
  if (navigator.onLine) {
    statusBadge.textContent = '🟢 Online';
    statusBadge.className   = 'status-badge online';
  } else {
    statusBadge.textContent = '🔴 Offline';
    statusBadge.className   = 'status-badge offline';
  }
}

// Set initial state and listen for changes
updateNetworkStatus();
window.addEventListener('online',  updateNetworkStatus);
window.addEventListener('offline', updateNetworkStatus);

/* ════════════════════════════════════════════════════════════════
   5. IN-MEMORY COLLECTION BUFFER
   Points added during the current session are held here until
   the user clicks "Save Data" to persist them to IndexedDB.
════════════════════════════════════════════════════════════════ */
let pendingPoints = [];   // Array of GeoJSON Feature objects

/* ════════════════════════════════════════════════════════════════
   6. ADD LOCATION BUTTON
   Toggles "adding mode": while active, a single click on the map
   drops a new marker and adds the point to pendingPoints[].
════════════════════════════════════════════════════════════════ */
let addingMode = false;   // tracks whether click-to-add is active

/**
 * Handler called by Leaflet when the user clicks the map.
 * Only active while addingMode === true.
 * @param {L.MouseEvent} e
 */
function onMapClick(e) {
  if (!addingMode) return;

  const { lat, lng } = e.latlng;
  const timestamp    = new Date().toISOString().slice(0, 19).replace('T', ' ');

  // Build a GeoJSON Feature for this point
  const feature = {
    type: 'Feature',
    id:   'collected-' + Date.now(),
    geometry: {
      type:        'Point',
      coordinates: [lng, lat]   // GeoJSON uses [longitude, latitude]
    },
    properties: {
      name:      `Field Point ${pendingPoints.length + 1}`,
      notes:     '',
      category:  'Collected',
      timestamp: timestamp
    }
  };

  // Add the orange pulsing marker to the map (via map.js)
  addCollectedMarker(lat, lng, feature.properties);

  // Buffer the feature until the user saves
  pendingPoints.push(feature);

  setStatus(
    `📍 Point added at ${lat.toFixed(5)}, ${lng.toFixed(5)} — ` +
    `${pendingPoints.length} unsaved point(s). Click 💾 Save Data to persist.`
  );

  console.log('[App] Point added to buffer:', feature.id);
}

// Attach the click handler to the Leaflet map (map is defined in map.js)
map.on('click', onMapClick);

// Toggle adding mode on button click
btnAddLocation.addEventListener('click', () => {
  addingMode = !addingMode;

  if (addingMode) {
    btnAddLocation.classList.add('active');
    btnAddLocation.textContent = '🛑 Cancel Add';
    mapEl.classList.add('adding-mode');
    setStatus('🖱️ Click anywhere on the map to add a field point.');
  } else {
    btnAddLocation.classList.remove('active');
    btnAddLocation.textContent = '➕ Add Location';
    mapEl.classList.remove('adding-mode');
    setStatus('Ready.');
  }
});

/* ════════════════════════════════════════════════════════════════
   7. SAVE DATA BUTTON
   Persists all pendingPoints[] to IndexedDB via storage.js,
   then clears the buffer.
════════════════════════════════════════════════════════════════ */
btnSaveData.addEventListener('click', () => {
  if (pendingPoints.length === 0) {
    setStatus('ℹ️ No new points to save. Use ➕ Add Location first.');
    return;
  }

  setStatus('💾 Saving…');

  // Save each pending point sequentially using Promise chaining
  const savePromises = pendingPoints.map((feature) => savePoint(feature));

  Promise.all(savePromises)
    .then(() => {
      const count = pendingPoints.length;
      pendingPoints = [];   // clear the buffer after successful save

      setStatus(`✅ ${count} point(s) saved to offline storage.`);
      console.log('[App] Saved', count, 'point(s) to IndexedDB');
    })
    .catch((err) => {
      console.error('[App] Save failed:', err);
      setStatus('❌ Save failed. See console for details.');
    });
});

/* ════════════════════════════════════════════════════════════════
   8. VIEW OFFLINE DATA BUTTON
   Reads all points from IndexedDB and re-renders them on the map.
   Clears any previously rendered collected markers first to avoid
   duplicates.
════════════════════════════════════════════════════════════════ */
btnViewOffline.addEventListener('click', () => {
  setStatus('📂 Loading offline data…');

  getAllPoints()
    .then((features) => {
      if (features.length === 0) {
        setStatus('ℹ️ No offline data found. Save some points first.');
        return;
      }

      // Remove existing collected markers before re-drawing
      clearCollectedMarkers();

      // Re-draw each stored feature on the map
      features.forEach((feature) => {
        const [lng, lat] = feature.geometry.coordinates;
        addCollectedMarker(lat, lng, feature.properties);
      });

      setStatus(`📂 ${features.length} offline point(s) loaded from storage.`);
      console.log('[App] Loaded', features.length, 'point(s) from IndexedDB');
    })
    .catch((err) => {
      console.error('[App] Failed to load offline data:', err);
      setStatus('❌ Could not load offline data. See console.');
    });
});

/* ════════════════════════════════════════════════════════════════
   9. INITIAL STATUS
════════════════════════════════════════════════════════════════ */
setStatus('Ready. Use ➕ Add Location to collect field points.');
