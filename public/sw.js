/**
 * EduIntellect Parent — Service Worker
 * Strategy:
 *   - Static assets (JS/CSS/HTML/images) → Cache-First (precached on install)
 *   - Firebase Firestore / Auth APIs     → Network-First (5 s timeout → cache)
 *   - Firebase Storage                   → Cache-First (long TTL)
 *   - Everything else                    → Network-First
 */

const CACHE_VERSION = 'v1';
const STATIC_CACHE  = `eduintellect-static-${CACHE_VERSION}`;
const API_CACHE     = `eduintellect-api-${CACHE_VERSION}`;
const STORAGE_CACHE = `eduintellect-storage-${CACHE_VERSION}`;

// Assets to precache on install (Vite injects __PRECACHE_MANIFEST__ in prod builds;
// here we fall back to a minimal shell so offline shows the app shell at least)
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// ── Install: precache shell ──────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: clean up old caches ───────────────────────────────────────────
self.addEventListener('activate', (event) => {
  const VALID = [STATIC_CACHE, API_CACHE, STORAGE_CACHE];
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => !VALID.includes(k)).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function isStaticAsset(url) {
  return /\.(js|css|woff2?|ttf|otf|ico|png|jpg|jpeg|svg|webp|gif)(\?.*)?$/.test(url.pathname);
}
function isFirebaseAPI(url) {
  return url.hostname.includes('firestore.googleapis.com') ||
         url.hostname.includes('identitytoolkit.googleapis.com') ||
         url.hostname.includes('securetoken.googleapis.com');
}
function isFirebaseStorage(url) {
  return url.hostname.includes('firebasestorage.googleapis.com');
}

/** Network-first with timeout; falls back to cache */
async function networkFirst(request, cacheName, timeoutMs = 5000) {
  const cache = await caches.open(cacheName);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timer);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached || new Response(JSON.stringify({ offline: true }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/** Cache-first; fetches and stores on miss */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

// ── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET and chrome-extension requests
  if (event.request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  if (isFirebaseAPI(url)) {
    event.respondWith(networkFirst(event.request, API_CACHE, 8000));
  } else if (isFirebaseStorage(url)) {
    event.respondWith(cacheFirst(event.request, STORAGE_CACHE));
  } else if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(event.request, STATIC_CACHE));
  } else if (url.origin === self.location.origin) {
    // App shell — network first, fall back to /index.html for SPA routing
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cache = await caches.open(STATIC_CACHE);
        return cache.match('/index.html') || cache.match('/');
      })
    );
  } else {
    event.respondWith(networkFirst(event.request, API_CACHE));
  }
});

// ── Push notifications (future use) ─────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const { title = 'EduIntellect', body = '', icon = '/icons/icon-192x192.png' } = event.data.json();
  event.waitUntil(
    self.registration.showNotification(title, { body, icon, badge: '/icons/icon-96x96.png' })
  );
});

// ── Skip waiting (triggered by PWAUpdatePrompt) ──────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
