// ================== SERVICE WORKER ==================
// Yeh file offline support aur PWA install ke liye zaroori hai
// Version v2 — nayi files cache karo, purana clear karo

var CACHE_NAME = 'atta-chakki-v2';
var urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// ================== INSTALL ==================
self.addEventListener('install', function(event) {
  console.log('✅ Service Worker v2 installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      console.log('✅ Files cached');
      // addAll fail ho jaye agar koi file missing ho — usko handle karo
      return Promise.all(
        urlsToCache.map(function(url) {
          return cache.add(url).catch(function(err) {
            console.log('⚠️ Cache add skip:', url, err.message);
          });
        })
      );
    })
  );
  self.skipWaiting();
});

// ================== ACTIVATE ==================
self.addEventListener('activate', function(event) {
  console.log('✅ Service Worker v2 activated');
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

// ================== FETCH ==================
self.addEventListener('fetch', function(event) {
  // Sirf GET requests handle karo
  if (event.request.method !== 'GET') return;

  // Firebase aur external requests ko skip karo (unhe hamesha network se lo)
  var url = event.request.url;
  if (url.indexOf('firebase') !== -1 ||
      url.indexOf('firebaseio') !== -1 ||
      url.indexOf('gstatic') !== -1 ||
      url.indexOf('googleapis') !== -1 ||
      url.indexOf('cloudflare') !== -1 ||
      url.indexOf('wa.me') !== -1 ||
      url.indexOf('whatsapp') !== -1 ||
      url.indexOf('cdnjs') !== -1) {
    return;
  }

  // HTML navigation requests ke liye — network first
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(function(response) {
          // Network se mila — cache mein update karo
          var responseToCache = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, responseToCache);
          });
          return response;
        })
        .catch(function() {
          // Network fail — cache se do
          return caches.match(event.request).then(function(cached) {
            return cached || caches.match('./index.html');
          });
        })
    );
    return;
  }

  // Baaki files — network first, cache fallback
  event.respondWith(
    fetch(event.request)
      .then(function(response) {
        if (response && response.status === 200 && response.type === 'basic') {
          var responseToCache = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(function() {
        return caches.match(event.request).then(function(cached) {
          if (cached) return cached;
          // Agar cache mein bhi nahi aur navigate request hai to index.html do
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});

// ================== MESSAGE ==================
// Page se message aaye to SW update kar do
self.addEventListener('message', function(event) {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
