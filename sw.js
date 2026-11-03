// Adaptia SW v132 - versioned cache, auto-update
var CACHE = "adaptia-s132";
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
// === PUSH NOTIFICATION (2026-09-23) ===
self.addEventListener("push", function(e) {
  var data = {};
  try { data = e.data ? e.data.json() : {}; } catch(err) { data = {}; }
  var title = data.title || "Adaptia";
  var opts = {
    body: data.body || "",
    icon: data.icon || "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: data.url || "/" }
  };
  e.waitUntil(self.registration.showNotification(title, opts));
});
self.addEventListener("notificationclick", function(e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(clients.matchAll({type:"window", includeUncontrolled:true}).then(function(list) {
    for (var i=0;i<list.length;i++) {
      if ("focus" in list[i]) { list[i].focus(); return undefined; }
    }
    if (clients.openWindow) return clients.openWindow(url);
  }));
});
