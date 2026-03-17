/* ================================================================
   storage.js  –  Offline Marine Spatial Analyzer PWA
   Handles all IndexedDB operations for offline data persistence.

   Database : GISFieldDB  (version 1)
   Object Store : "collected_points"
     – keyPath  : "id"  (auto-generated timestamp string)
     – Stores GeoJSON-compatible feature objects
   ================================================================ */

'use strict';

/* ── Database configuration ── */
const DB_NAME    = 'GISFieldDB';
const DB_VERSION = 1;
const STORE_NAME = 'collected_points';

/* ── Module-level DB connection (reused across calls) ── */
let _db = null;

/* ================================================================
   openDB()
   Opens (or creates) the IndexedDB database.
   Returns a Promise that resolves with the IDBDatabase instance.
   ================================================================ */
function openDB() {
  return new Promise((resolve, reject) => {

    // Return cached connection if already open
    if (_db) {
      resolve(_db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    /* Called when the database is created for the first time
       or when DB_VERSION is incremented. */
    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Create the object store only if it doesn't already exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });

        // Index by category so we can query by type later
        store.createIndex('category', 'properties.category', { unique: false });

        console.log('[Storage] Object store created:', STORE_NAME);
      }
    };

    request.onsuccess = (event) => {
      _db = event.target.result;
      console.log('[Storage] Database opened:', DB_NAME);
      resolve(_db);
    };

    request.onerror = (event) => {
      console.error('[Storage] Failed to open database:', event.target.error);
      reject(event.target.error);
    };
  });
}

/* ================================================================
   savePoint(feature)
   Saves a single GeoJSON Feature object to IndexedDB.

   @param {Object} feature  – A GeoJSON Feature with geometry & properties
   @returns {Promise<string>}  – Resolves with the saved record's id
   ================================================================ */
function savePoint(feature) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {

      // Assign a unique id based on timestamp if not already set
      if (!feature.id) {
        feature.id = 'collected-' + Date.now();
      }

      const tx      = db.transaction(STORE_NAME, 'readwrite');
      const store   = tx.objectStore(STORE_NAME);
      const request = store.put(feature);   // put = insert or update

      request.onsuccess = () => {
        console.log('[Storage] Point saved:', feature.id);
        resolve(feature.id);
      };

      request.onerror = (event) => {
        console.error('[Storage] Failed to save point:', event.target.error);
        reject(event.target.error);
      };
    });
  });
}

/* ================================================================
   getAllPoints()
   Retrieves all stored GeoJSON Feature objects from IndexedDB.

   @returns {Promise<Array>}  – Resolves with an array of Feature objects
   ================================================================ */
function getAllPoints() {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {

      const tx      = db.transaction(STORE_NAME, 'readonly');
      const store   = tx.objectStore(STORE_NAME);
      const request = store.getAll();   // fetch every record

      request.onsuccess = (event) => {
        const results = event.target.result;
        console.log('[Storage] Retrieved', results.length, 'point(s) from DB');
        resolve(results);
      };

      request.onerror = (event) => {
        console.error('[Storage] Failed to retrieve points:', event.target.error);
        reject(event.target.error);
      };
    });
  });
}

/* ================================================================
   deletePoint(id)
   Deletes a single record by its id key.

   @param {string} id  – The id of the feature to delete
   @returns {Promise<void>}
   ================================================================ */
function deletePoint(id) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {

      const tx      = db.transaction(STORE_NAME, 'readwrite');
      const store   = tx.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log('[Storage] Point deleted:', id);
        resolve();
      };

      request.onerror = (event) => {
        console.error('[Storage] Failed to delete point:', event.target.error);
        reject(event.target.error);
      };
    });
  });
}

/* ================================================================
   clearAllPoints()
   Removes every record from the object store.
   Useful for a "reset" feature during development.

   @returns {Promise<void>}
   ================================================================ */
function clearAllPoints() {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {

      const tx      = db.transaction(STORE_NAME, 'readwrite');
      const store   = tx.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        console.log('[Storage] All points cleared from DB');
        resolve();
      };

      request.onerror = (event) => {
        console.error('[Storage] Failed to clear store:', event.target.error);
        reject(event.target.error);
      };
    });
  });
}
