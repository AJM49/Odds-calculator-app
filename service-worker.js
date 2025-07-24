self.addEventListener('install', event => {
  console.log('🔧 Service Worker installing...');
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('🚀 Service Worker ready!');
});

self.addEventListener('fetch', event => {
  // You can cache resources here later
});


