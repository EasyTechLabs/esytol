"use client";

/**
 * Vyora — install banner, first-run tutorial and update prompt (V2-005).
 *
 * Three small surfaces that only ever appear when they can lead somewhere:
 * the banner hides once installed or dismissed, the tutorial shows once ever,
 * and the update prompt waits for the merchant rather than refreshing under
 * their hands mid-entry.
 *
 * All decisions come from `lib/vyora/pwa.ts`; this file only renders them.
 */

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_PWA_FLAGS,
  SW_PATH,
  SW_SCOPE,
  TUTORIAL_PAGES,
  detectInstallState,
  shouldShowInstallBanner,
  shouldShowTutorial,
  type InstallState,
  type PwaFlags,
} from "@/lib/vyora/pwa";
import { useVyora } from "./VyoraProvider";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaSurfaces() {
  // Persistence goes through the provider, like every other screen — no
  // component touches storage directly (ARCH-003).
  const { pwaFlags, setPwaFlags } = useVyora();
  const flags: PwaFlags = pwaFlags ?? DEFAULT_PWA_FLAGS;
  const [state, setState] = useState<InstallState | null>(null);
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [updateReady, setUpdateReady] = useState<ServiceWorkerRegistration | null>(null);
  const [page, setPage] = useState(0);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    setState(detectInstallState(window, navigator));

    const onPrompt = (event: Event) => {
      // Keep the event so the merchant can install when THEY choose to.
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setPrompt(null);
      setState(detectInstallState(window, navigator));
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    let registration: ServiceWorkerRegistration | undefined;
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register(SW_PATH, { scope: SW_SCOPE })
        .then((reg) => {
          registration = reg;
          if (reg.waiting) setUpdateReady(reg);
          reg.addEventListener("updatefound", () => {
            const incoming = reg.installing;
            incoming?.addEventListener("statechange", () => {
              // A new build is ready, but only matters if one was already running.
              if (incoming.state === "installed" && navigator.serviceWorker.controller) {
                setUpdateReady(reg);
              }
            });
          });
        })
        .catch(() => {
          // No service worker (unsupported, or blocked). The app still works —
          // it just will not open without a network.
        });
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      void registration;
    };
  }, []);

  const update = useCallback((patch: Partial<PwaFlags>) => setPwaFlags(patch), [setPwaFlags]);

  const install = async () => {
    if (!prompt) {
      setShowIosHelp(true);
      return;
    }
    await prompt.prompt();
    const choice = await prompt.userChoice;
    setPrompt(null);
    if (choice.outcome === "dismissed") update({ installBannerDismissed: true });
  };

  const applyUpdate = () => {
    updateReady?.waiting?.postMessage("VYORA_SKIP_WAITING");
    setUpdateReady(null);
    window.location.reload();
  };

  if (!state) return null;

  const showTutorial = shouldShowTutorial(flags);
  const showBanner = !showTutorial && shouldShowInstallBanner(state, flags, prompt !== null);

  return (
    <>
      {/* Update — offered, never applied behind the merchant's back. */}
      {updateReady && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5">
          <span className="text-sm font-medium text-brand-900">New version available</span>
          <button
            type="button"
            onClick={applyUpdate}
            className="shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white"
          >
            Reload
          </button>
        </div>
      )}

      {/* Install */}
      {showBanner && (
        <div className="mb-3 rounded-2xl border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-bold text-gray-900">Install Vyora on this phone</h2>
          <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-600">
            <li>✓ Works offline</li>
            <li>✓ Private — data stays here</li>
            <li>✓ No login</li>
            <li>✓ Opens instantly</li>
          </ul>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={install}
              className="flex-1 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white"
            >
              Install Vyora
            </button>
            <button
              type="button"
              onClick={() => update({ installBannerDismissed: true })}
              className="rounded-xl border-2 border-gray-200 px-3 text-sm font-semibold text-gray-500"
            >
              Not now
            </button>
          </div>
          {(showIosHelp || state.needsManualInstall) && (
            <ol className="mt-3 space-y-1 rounded-xl bg-gray-50 p-3 text-xs text-gray-700">
              <li>1. Tap the Share button in Safari</li>
              <li>2. Choose &ldquo;Add to Home Screen&rdquo;</li>
              <li>3. Tap Add — Vyora appears with your apps</li>
            </ol>
          )}
        </div>
      )}

      {/* First run only */}
      {showTutorial && (
        <div className="mb-3 rounded-2xl border border-gray-200 bg-white p-5 text-center">
          <div className="text-4xl leading-none">{TUTORIAL_PAGES[page].icon}</div>
          <h2 className="mt-3 text-base font-bold text-gray-900">{TUTORIAL_PAGES[page].title}</h2>
          <p className="mt-1 text-sm text-gray-600">{TUTORIAL_PAGES[page].body}</p>
          <div className="mt-3 flex items-center justify-center gap-1.5">
            {TUTORIAL_PAGES.map((item, index) => (
              <span
                key={item.title}
                className={`h-1.5 w-1.5 rounded-full ${
                  index === page ? "bg-brand-600" : "bg-gray-300"
                }`}
              />
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => update({ tutorialSeen: true })}
              className="rounded-xl border-2 border-gray-200 px-3 py-2 text-sm font-semibold text-gray-500"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={() =>
                page === TUTORIAL_PAGES.length - 1
                  ? update({ tutorialSeen: true })
                  : setPage(page + 1)
              }
              className="flex-1 rounded-xl bg-brand-600 py-2 text-sm font-semibold text-white"
            >
              {page === TUTORIAL_PAGES.length - 1 ? "Start using Vyora" : "Next"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
