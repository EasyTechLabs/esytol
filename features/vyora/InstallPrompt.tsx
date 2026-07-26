"use client";

/**
 * Vyora — install banner (P3-006). Makes Vyora feel like a real app: a friendly
 * prompt that explains WHY to install (works offline · fast · no login · private)
 * and installs in one tap on Android/desktop, or shows the Add-to-Home-Screen
 * hint on iOS Safari (which has no install event). Hidden once installed or once
 * the merchant dismisses it forever. Nothing here touches ledger data.
 */

import { useEffect, useState } from "react";

const DISMISS_KEY = "vyora.install.dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const BENEFITS = [
  { icon: "📴", label: "Works offline" },
  { icon: "⚡", label: "Fast" },
  { icon: "🔓", label: "No login" },
  { icon: "🔒", label: "Private" },
];

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      /* storage blocked — carry on */
    }
    if (isStandalone()) return; // already installed

    const onBeforeInstall = (e: Event) => {
      e.preventDefault(); // keep our own banner; suppress the mini-infobar
      setDeferred(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    const onInstalled = () => setShow(false);
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    // iOS Safari never fires beforeinstallprompt — offer the manual route instead.
    const ua = navigator.userAgent;
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    const isSafari = isIOS && /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
    if (isSafari) {
      setIosHint(true);
      setShow(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setShow(false);
  };

  const install = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch {
      /* prompt failed/cancelled — leave the banner as-is */
    }
    setDeferred(null);
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-[6.5rem] z-40 mx-auto w-full max-w-lg px-4 print:hidden">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white"
          >
            V
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-900">Install Vyora</p>
            <p className="text-sm text-gray-600">
              Add it to your home screen — it opens like an app.
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Don't show again"
            className="-mr-1 -mt-1 shrink-0 rounded-lg px-2 py-1 text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <ul className="mt-3 grid grid-cols-2 gap-2">
          {BENEFITS.map((b) => (
            <li
              key={b.label}
              className="flex items-center gap-2 rounded-lg bg-gray-50 px-2.5 py-1.5 text-sm text-gray-700"
            >
              <span aria-hidden>{b.icon}</span>
              {b.label}
            </li>
          ))}
        </ul>

        {iosHint ? (
          <p className="text-brand-800 mt-3 rounded-xl bg-brand-50 px-3 py-2 text-sm">
            Tap the Share button <span aria-hidden>⎋</span>, then{" "}
            <strong>Add to Home Screen</strong>.
          </p>
        ) : (
          <button
            type="button"
            onClick={install}
            className="mt-3 w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
          >
            Install app
          </button>
        )}

        <button
          type="button"
          onClick={dismiss}
          className="mt-2 w-full py-1 text-center text-xs font-medium text-gray-500 hover:text-gray-700"
        >
          Don&rsquo;t show again
        </button>
      </div>
    </div>
  );
}
