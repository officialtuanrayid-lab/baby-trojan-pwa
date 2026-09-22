// Adaptia SW v6.1 - Network-first for HTML, cache-first for assets
var CACHE = "adaptia-v6.1";
var PRECACHE = [
  "/",
  "/index.html",
  "/manifest.json",
  "/welcome-icon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];
self.addEventListener("install", function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(c) { return c.addAll(PRECACHE); }).then(function() { return self.skipWaiting(); })
  );
});
self.addEventListener("activate", function(e) {
  e.waitUntil(
    caches.keys().then(function(ks) {
      return Promise.all(ks.map(function(k) { return caches.delete(k); }));
    }).then(function() { return self.clients.claim(); })
  );
});
self.addEventListener("fetch", function(e) {
  var url = new URL(e.request.url);
  // Network-first for API and HTML (always fresh)
  if (url.pathname.includes("/api/") || url.pathname === "/sw.js" || url.pathname === "/" || url.pathname === "/index.html" || url.pathname.endsWith(".html") || url.pathname.endsWith(".json")) {
    e.respondWith(fetch(e.request).then(function(res) {
      var clone = res.clone();
      caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
      return res;
    }).catch(function() { return caches.match(e.request).then(function(r) { return r || new Response("Offline",{status:503}); }); }));
    return;
  }
  // Cache-first for static assets (images, fonts, etc)
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      if (cached) {
        fetch(e.request).then(function(res) {
          caches.open(CACHE).then(function(c) { c.put(e.request, res.clone()); });
        }).catch(function(){});
        return cached;
      }
      return fetch(e.request).then(function(res) {
        var clone = res.clone();
        caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
        return res;
      });
    }).catch(function() {
      return new Response("Offline",{status:503});
    })
  );
});
self.addEventListener("message", function(e) {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});
