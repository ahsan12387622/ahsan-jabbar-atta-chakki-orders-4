// ================== SERVICE WORKER ==================
// Yeh file offline support aur PWA install ke liye zaroori hai

var CACHE_NAME = 'atta-chakki-v1';
var urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json'
];

// Install event — cache files
self.addEventListener('install', function(event) {
  console.log('✅ Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      console.log('✅ Files cached');
      return cache.addAll(urlsToCache).catch(function(err) {
        console.log('⚠️ Cache add error (kuch files missing):', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate event — purane cache clear karo
self.addEventListener('activate', function(event) {
  console.log('✅ Service Worker activated');
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Old cache deleted:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event — network first, cache fallback
self.addEventListener('fetch', function(event) {
  // Sirf GET requests handle karo
  if (event.request.method !== 'GET') return;

  // Firebase aur external requests ko skip karo
  var url = event.request.url;
  if (url.indexOf('firebase') !== -1 ||
      url.indexOf('gstatic') !== -1 ||
      url.indexOf('googleapis') !== -1 ||
      url.indexOf('cloudflare') !== -1 ||
      url.indexOf('wa.me') !== -1) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(function(response) {
        // Network se mila — cache mein copy rakho
        if (response && response.status === 200 && response.type === 'basic') {
          var responseToCache = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(function() {
        // Network fail — cache se do
        return caches.match(event.request).then(function(cached) {
          if (cached) return cached;
          // Agar cache mein bhi nahi, to index.html do (offline fallback)
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
