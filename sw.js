// Adaptia SW v19 - versioned cache, auto-update
var CACHE = "adaptia-s19";
self.addEventListener("install", function(e) { self.skipWaiting(); });
self.addEventListener("activate", function(e) {
  e.waitUntil(caches.keys().then(function(ks) {
    return Promise.all(ks.map(function(k) { return caches.delete(k); }));
  }).then(function() { return self.clients.claim(); }));
});
self.addEventListener("fetch", function(e) {
  var url = new URL(e.request.url);
  if (url.pathname.includes("/api/") || url.pathname.includes("/voices/") || url.pathname === "/sw.js") return;
  if (url.pathname === "/" || url.pathname === "/index.html" || url.pathname.endsWith(".html")) return;
  e.respondWith(
    fetch(e.request).then(function(res) {
      var clone = res.clone();
      caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
      return res;
    }).catch(function() { return caches.match(e.request); })
  );
});
self.addEventListener("message", function(e) {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});