const CACHE_NAME = 'odds-calculator-cache-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.png',
  '/style.css',
  '/app.js',
  '/bankroll.js',
  '/settle.js',
  '/racecard.js',
  '/dashboard.html',
  '/dashboard.css',
  '/dashboard.js',
  '/dashboard-race.js'
];

// Install: precache the app shell, then take over right away instead of
// waiting for every old tab to close.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// Activate: delete every older cache (v1 served stale app.js indefinitely)
// and claim open pages so the fix applies on the next load.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(
        names.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch: network-first for page and code requests, so a fresh deploy is
// picked up immediately; the cache is only a fallback when offline.
// API calls (Netlify functions, Firebase/Google endpoints) are never
// cached — live data must stay live.
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isApi = url.pathname.startsWith('/.netlify/functions/')
    || url.hostname.endsWith('googleapis.com')
    || url.hostname.endsWith('firebaseapp.com');
  if (isApi) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && (response.status === 200 || response.type === 'opaque')) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
