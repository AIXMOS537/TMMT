// HAILMARY service worker — minimal, network-first with an offline shell cache.
// Enables PWA install on Chrome/Android/desktop and keeps the console openable
// when briefly offline. Never caches API POSTs.
const CACHE = "hailmary-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return; // never intercept API writes
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req))
  );
});
