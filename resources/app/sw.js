const CACHE_NAME = 'tameshk-accounting-offline-v41';
const APP_FILES = ["./", "./index.html", "./calendar-input.js", "./calendar-fields.js", "./localization.js", "./invoice-print-layout.js", "./template-manager.js", "./inventory-ledger.js", "./desktop-features.js", "./packaging-manager.js", "./profile-photo-security.js", "./inventory-profiles.js", "./settings-tabs.js", "./barcode.js", "./catalog-images.js", "./donation-page.js", "./enhancements-146.js", "./transaction-enhancements.js", "./inventory-management.js", "./inventory-entry-enhancements.js", "./report-wallet-numbering.js", "./financial-modules.js", "./assets-module.js", "./portable-data.js", "./returns-management.js", "./finance-accounting.js", "./record-appearance.js", "./bulk-price-import.js", "./service-management.js", "./help-center.js", "./ancillary-accounting.js", "./transaction-form-layout.js", "./transaction-invoice-output.js", "./table-pagination.js", "./state-merge.js", "./desktop-widget.js", "./feature-controls.js", "./notification-center.js", "./workflow-polish.js", "./manifest.webmanifest", "./currency-locale-1.50.4.js", "./tabular-locale-1.50.4.js", "./locale-layout-1.50.4.js", "./currency-records-1.50.6.js", "./startup-1.50.6.js", "./icon.svg", "./icon-192.png", "./icon-512.png"];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_FILES)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response && response.ok) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
    }
    return response;
  }).catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html'))));
});
