// public/sw.js — ChessLens Service Worker (Phase 6 Offline & PWA)
// Precaches app shell, versioned engine WASM & JS, piece sets, and sounds.
// Cache versioning ensures that new engine builds automatically invalidate stale caches.

const CACHE_NAME = 'chesslens-v1-sf18';

const PRECACHE_ASSETS = [
  '/',
  '/review',
  '/library',
  '/dashboard',
  '/trainer',
  '/manifest.json',
  '/engine/stockfish-18-lite-single.v1.js',
  '/engine/stockfish-18-lite-single.v1.wasm',
  '/engine/stockfish-18-lite-mt.v1.js',
  '/engine/stockfish-18-lite-mt.v1.wasm',
  '/pieces/wP.svg',
  '/pieces/wN.svg',
  '/pieces/wB.svg',
  '/pieces/wR.svg',
  '/pieces/wQ.svg',
  '/pieces/wK.svg',
  '/pieces/bP.svg',
  '/pieces/bN.svg',
  '/pieces/bB.svg',
  '/pieces/bR.svg',
  '/pieces/bQ.svg',
  '/pieces/bK.svg',
];

// Install: precache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        // Use individual add or all with graceful error handling for optional assets
        return Promise.allSettled(
          PRECACHE_ASSETS.map((url) =>
            cache.add(url).catch((err) => {
              console.warn('[SW] Precache failed for:', url, err);
            })
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// Activate: purge old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch: Cache-first for static immutable assets; Network-first with cache fallback for pages
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Don't intercept API routes (stateless proxies)
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Immutable/Static assets (engine, pieces, static next assets) -> Cache-first
  const isStatic =
    url.pathname.startsWith('/engine/') ||
    url.pathname.startsWith('/pieces/') ||
    url.pathname.startsWith('/sounds/') ||
    url.pathname.startsWith('/_next/static/');

  if (isStatic) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Navigation and other requests -> Network-first with offline cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          if (request.mode === 'navigate') {
            return caches.match('/review').then((reviewCached) => {
              return reviewCached || caches.match('/');
            });
          }
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        });
      })
  );
});
