/**
 * Vyora — service worker, served at /vyora/sw.js (ENG-006).
 *
 * Served from a route so it can (a) set `Service-Worker-Allowed: /vyora` to claim
 * the whole `/vyora` scope even though the script sits under it, and (b) stamp a
 * per-deploy VERSION so a new build is detected as a new worker ("New version
 * available"). No shared next.config change.
 *
 * The worker caches ONLY static assets (the app shell HTML, `/_next/static/*`,
 * self-hosted fonts, icons, manifest). It NEVER caches ledger data — there is none
 * on the wire: the ledger lives entirely in localStorage and never touches the
 * network. Non-GET, cross-origin, and out-of-scope requests are passed straight
 * through, untouched.
 */

export const dynamic = "force-dynamic";

const VERSION = (
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.NEXT_PUBLIC_BUILD_ID ??
  "dev"
).slice(0, 12);

const SW = `
const VERSION = ${JSON.stringify(VERSION)};
const CACHE = "vyora-" + VERSION;
// Precached app shell — enough to open Vyora with no network.
const SHELL = ["/vyora", "/vyora/offline", "/vyora/manifest.webmanifest", "/vyora/icon.svg", "/vyora/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  // Do NOT skipWaiting automatically — wait for the user's "Reload" so we can show the banner.
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k.indexOf("vyora-") === 0 && k !== CACHE).map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

function cacheFirst(req) {
  return caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res && res.ok && res.type === "basic") {
      const clone = res.clone();
      caches.open(CACHE).then((c) => c.put(req, clone));
    }
    return res;
  }));
}

function networkFirst(req) {
  return fetch(req).then((res) => {
    if (res && res.ok) {
      const clone = res.clone();
      caches.open(CACHE).then((c) => c.put(req, clone));
    }
    return res;
  }).catch(() =>
    caches.match(req)
      .then((hit) => hit || caches.match("/vyora/offline"))
      .then((hit) => hit || caches.match("/vyora"))
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;                 // never touch writes
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;  // never touch cross-origin
  const inScope = url.pathname.indexOf("/vyora") === 0 || url.pathname.indexOf("/_next/") === 0;
  if (!inScope) return;                             // leave the rest of the site alone

  // Content-hashed static assets → cache-first (instant + offline; new builds have new URLs).
  const isStatic =
    url.pathname.indexOf("/_next/static/") === 0 ||
    /\\.(?:js|css|woff2?|png|svg|ico|json|webmanifest)$/.test(url.pathname);
  if (isStatic) { event.respondWith(cacheFirst(req)); return; }

  // Navigations (the app shell HTML) → network-first, fall back to cache, then offline page.
  if (req.mode === "navigate") { event.respondWith(networkFirst(req)); return; }

  event.respondWith(fetch(req).catch(() => caches.match(req)));
});
`;

export function GET() {
  return new Response(SW, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Service-Worker-Allowed": "/vyora",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
