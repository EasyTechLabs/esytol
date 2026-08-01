/**
 * Vyora — offline shell service worker (V2-005).
 *
 * SCOPE IS DELIBERATE. This file lives at /vyora/sw.js so its scope is
 * /vyora/ and nothing else. esytol hosts many other tools on the same origin;
 * a root-scoped worker would start intercepting all of them, which is not this
 * milestone's business and would be very hard to undo on a live site.
 *
 * The ledger is already local, so "offline" needs no sync layer — only a shell
 * to open. There is no background sync, no push, no telemetry, and no network
 * call this worker makes on its own.
 *
 * Updates never apply themselves. A new worker waits until the merchant taps
 * Reload — losing a half-typed entry to a surprise refresh would be worse than
 * running yesterday's build for another minute.
 */

const SW_VERSION = "1.0.0-rc1";
const SHELL_CACHE = `vyora-shell-${SW_VERSION}`;
const RUNTIME_CACHE = `vyora-runtime-${SW_VERSION}`;
const OFFLINE_URL = "/vyora/offline.html";

const SHELL_ASSETS = [
  OFFLINE_URL,
  "/vyora/manifest.webmanifest",
  "/vyora/icon.svg",
  "/vyora/icon-maskable.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // Individually, so one missing asset cannot fail the whole install.
      .then((cache) => Promise.allSettled(SHELL_ASSETS.map((url) => cache.add(url))))
  );
  // Deliberately NOT skipWaiting — the merchant decides when to update.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("vyora-") && !key.endsWith(SW_VERSION))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

/** The app shell tells us when the merchant has chosen to take the update. */
self.addEventListener("message", (event) => {
  if (event.data === "VYORA_SKIP_WAITING") self.skipWaiting();
  if (event.data === "VYORA_VERSION") {
    event.source?.postMessage({ type: "VYORA_VERSION", version: SW_VERSION });
  }
});

function isVyoraRequest(url) {
  return url.origin === self.location.origin && url.pathname.startsWith("/vyora");
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Page loads: try the network, fall back to whatever we have, and fall back
  // to the offline shell. A merchant must never see a browser error page.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || (await caches.match(OFFLINE_URL)) || Response.error();
        })
    );
    return;
  }

  // Build assets are content-hashed, so cache-first is safe and instant.
  const isBuildAsset = url.pathname.startsWith("/_next/static");
  if (isBuildAsset || isVyoraRequest(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request)
            .then((response) => {
              if (response.ok) {
                const copy = response.clone();
                caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
              }
              return response;
            })
            .catch(() => cached || Response.error())
      )
    );
  }
});
