"use client";

/**
 * Vyora — service-worker lifecycle (ENG-006). Registers /vyora/sw.js (production
 * only, so it never fights Next's dev HMR), watches for a newer build, and shows a
 * "New version available" banner whose Reload activates the waiting worker and
 * refreshes once. No ledger data ever passes through here — the worker caches
 * static assets only.
 */

import { useEffect, useRef, useState } from "react";

export function ServiceWorkerManager() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const refreshing = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    let reg: ServiceWorkerRegistration | undefined;

    const onControllerChange = () => {
      // Only reload when WE activated a new worker (guards against a first-install reload loop).
      if (!refreshing.current) return;
      window.location.reload();
    };

    navigator.serviceWorker
      .register("/vyora/sw.js", { scope: "/vyora" })
      .then((r) => {
        reg = r;
        if (r.waiting && navigator.serviceWorker.controller) setWaiting(r.waiting);
        r.addEventListener("updatefound", () => {
          const nw = r.installing;
          if (!nw) return;
          nw.addEventListener("statechange", () => {
            // A new worker finished installing while an old one still controls the page → update ready.
            if (nw.state === "installed" && navigator.serviceWorker.controller) setWaiting(nw);
          });
        });
      })
      .catch(() => {
        /* SW unsupported or blocked — the app still works online, just without offline cache. */
      });

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    // Re-check for a new deploy hourly while the app stays open.
    const iv = window.setInterval(() => reg?.update().catch(() => {}), 60 * 60 * 1000);

    return () => {
      window.clearInterval(iv);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  if (!waiting) return null;

  const reload = () => {
    refreshing.current = true;
    waiting.postMessage({ type: "SKIP_WAITING" });
  };

  return (
    <div className="fixed inset-x-0 bottom-24 z-50 mx-auto flex w-full max-w-lg items-center justify-between gap-3 rounded-xl bg-gray-900 px-4 py-3 text-sm text-white shadow-lg print:hidden">
      <span className="min-w-0 flex-1">A new version of Vyora is available.</span>
      <button
        type="button"
        onClick={reload}
        className="shrink-0 rounded-lg bg-white/20 px-3 py-1 font-semibold hover:bg-white/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
      >
        Reload
      </button>
    </div>
  );
}
