// TMMT service worker — deliberately minimal and safe.
// It caches ONLY the offline fallback page. Every real request goes to the
// network first; the cached page is shown only when a navigation fails because
// you're offline. Nothing dynamic (data, auth, API) is ever cached, so it can
// never serve stale info while you're online.
const CACHE = "tmmt-shell-v2";
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.add(OFFLINE_URL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // never touch writes
  // Only intercept page navigations; let everything else hit the network normally.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
  }
});
