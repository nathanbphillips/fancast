/* FanCast service worker (FR-5.2): offline shell for home, built
 * push-ready for v1.1 web push. Audio streams are never cached. */
const CACHE = "fc-shell-v1";
const SHELL = ["/", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // navigations: network first, fall back to the cached home shell offline
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match("/").then((hit) => hit ?? Response.error()),
      ),
    );
    return;
  }

  // static icons: cache first
  if (url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then((hit) => hit ?? fetch(request)),
    );
  }
});

/* push-ready (FR-16.3, v1.1): wired but unused until web push ships */
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || "FanCast", {
      body: payload.body || "",
      icon: "/icons/icon-192.png",
      data: payload.data || {},
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/";
  event.waitUntil(self.clients.openWindow(target));
});
