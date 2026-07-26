"use client";

/**
 * Vyora — post-install welcome tour (P3-006). On the first launch as an installed
 * app, a 3-slide tutorial covers the whole loop: add a contact, record credit,
 * collect payment. Skippable, and dismissed forever once seen. Purely presentational
 * — no ledger data involved.
 */

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

const DONE_KEY = "vyora.tutorial.done";

const SLIDES = [
  {
    icon: "👤",
    title: "Add a contact",
    body: "Tap Contacts, then +. A customer or supplier — a phone number is optional.",
  },
  {
    icon: "📝",
    title: "Record credit",
    body: "Tap + Credit. Enter the amount and who — their outstanding updates instantly.",
  },
  {
    icon: "💰",
    title: "Collect payment",
    body: "Tap + Payment when they pay. The balance drops, and shows “Settled” at zero.",
  },
];

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

export function WelcomeTour() {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (localStorage.getItem(DONE_KEY) === "1") return;
    } catch {
      return;
    }
    if (isStandalone()) setOpen(true); // launched as an installed app
    const onInstalled = () => setOpen(true); // just installed this session
    window.addEventListener("appinstalled", onInstalled);
    return () => window.removeEventListener("appinstalled", onInstalled);
  }, []);

  const finish = () => {
    try {
      localStorage.setItem(DONE_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  if (!open) return null;
  const slide = SLIDES[i]!;
  const last = i === SLIDES.length - 1;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-brand-700">
            Welcome to Vyora
          </span>
          <button
            type="button"
            onClick={finish}
            className="rounded-lg px-2 py-1 text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            Skip
          </button>
        </div>

        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div
            aria-hidden
            className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-3xl"
          >
            {slide.icon}
          </div>
          <h2 className="text-lg font-semibold text-gray-900">{slide.title}</h2>
          <p className="mx-auto max-w-xs text-sm text-gray-600">{slide.body}</p>
        </div>

        <div className="mb-4 flex items-center justify-center gap-1.5" aria-hidden>
          {SLIDES.map((_, idx) => (
            <span
              key={idx}
              className={cn(
                "h-1.5 rounded-full transition-all",
                idx === i ? "w-5 bg-brand-600" : "w-1.5 bg-gray-300"
              )}
            />
          ))}
        </div>

        <div className="flex gap-2">
          {i > 0 && (
            <button
              type="button"
              onClick={() => setI(i - 1)}
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={() => (last ? finish() : setI(i + 1))}
            className="flex-1 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
          >
            {last ? "Get started" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
