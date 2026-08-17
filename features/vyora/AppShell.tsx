"use client";

/**
 * Vyora Alpha — the app shell. A slim top bar and a fixed bottom action bar so
 * recording a credit or payment is always one tap away, from any screen.
 * Phone-first; big targets; nothing to explain.
 */

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { navRoutes } from "./modules";
import { PwaSurfaces } from "./PwaSurfaces";
import { ReadOnlyTabNotice } from "./ReadOnlyTabNotice";
import { SyncBar } from "./SyncBar";

/** Taps on the "Alpha" badge that open Founder Mode. */
const FOUNDER_TAPS = 5;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isHome = pathname === "/vyora";
  // The capture screens hide the floating buttons — you are already there.
  const isCapture = pathname === "/vyora/credit" || pathname === "/vyora/payment";
  const [taps, setTaps] = useState(0);

  // Hidden entry point: nothing links to Founder Mode, and a merchant cannot
  // reach it by accident.
  const tapBadge = () => {
    const next = taps + 1;
    if (next >= FOUNDER_TAPS) {
      setTaps(0);
      router.push("/vyora/founder");
      return;
    }
    setTaps(next);
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col bg-gray-50">
      {/* Top bar */}
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-gray-200 bg-white px-4 py-3">
        {!isHome ? (
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Back"
            className="-ml-1 rounded-lg p-1 text-gray-600 hover:bg-gray-100"
          >
            ‹ Back
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <Link href="/vyora" className="text-lg font-bold text-brand-700">
              Vyora
            </Link>
            <button
              type="button"
              onClick={tapBadge}
              aria-label="Vyora Alpha"
              className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-brand-700"
            >
              Alpha
            </button>
          </div>
        )}
      </header>

      {/* Alpha banner — visible on every screen */}
      <div
        role="note"
        className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-amber-800 print:hidden"
      >
        <p className="text-xs font-semibold">Vyora Alpha · Early Access Preview</p>
        <p className="text-[11px] leading-snug text-amber-700">
          Data is stored only in this browser. Do not rely on it for business-critical records.
        </p>
      </div>

      {/* Content */}
      <main className="flex-1 px-4 pb-28 pt-4">
        <PwaSurfaces />
        {/* Above the screen, not inside it: a tab that cannot save should say so
            before the merchant starts typing, on every screen. */}
        <ReadOnlyTabNotice />
        {/* One line, four possible things to say, and none of them is a cursor.
            Hidden entirely until there is something true to report — a browser
            that is not signed into a shop is not "not syncing", it is just an
            app, and a permanent grey tick would only invite the question. */}
        <SyncBar />
        {children}
      </main>

      {/* Capture as floating actions, sitting just above the bar in easy thumb
          reach. Recording money is not navigation — it is why the app is open. */}
      {!isCapture && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[4.75rem] z-20 mx-auto w-full max-w-lg px-3">
          <div className="pointer-events-auto flex justify-end gap-2">
            <Link
              href="/vyora/payment"
              className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg"
            >
              ＋ Payment
            </Link>
            <Link
              href="/vyora/credit"
              className="flex items-center gap-1.5 rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-lg"
            >
              ＋ Credit
            </Link>
          </div>
        </div>
      )}

      {/* Bottom bar — four destinations, assembled from the module registry. */}
      <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto flex w-full max-w-lg items-stretch border-t border-gray-200 bg-white px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {navRoutes().map((route) => (
          <NavIcon
            key={route.path}
            href={route.path}
            active={route.path === "/vyora" ? isHome : pathname.startsWith(route.path)}
            label={route.label}
            icon={route.icon ?? "•"}
          />
        ))}
      </nav>
    </div>
  );
}

function NavIcon({
  href,
  active,
  label,
  icon,
}: {
  href: string;
  active: boolean;
  label: string;
  icon: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-1 flex-col items-center justify-center rounded-xl py-1.5 text-[10px] font-medium",
        active ? "text-brand-700" : "text-gray-500"
      )}
    >
      <span className="text-lg leading-none">{icon}</span>
      {label}
    </Link>
  );
}
