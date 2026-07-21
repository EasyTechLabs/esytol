"use client";

/**
 * Vyora Alpha — the app shell. A slim top bar and a fixed bottom action bar so
 * recording a credit or payment is always one tap away. Phone-first, iOS
 * safe-area aware. The "Alpha" badge is the hidden gesture into Founder Mode
 * (tap it 5× quickly) — no visible menu, purely local diagnostics.
 */

import { useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { GlobalSearch } from "./GlobalSearch";

const SAFE_BOTTOM = "calc(0.625rem + env(safe-area-inset-bottom))";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isHome = pathname === "/vyora";

  // Hidden Founder-Mode gesture: 5 quick taps on the Alpha badge.
  const taps = useRef<{ n: number; at: number }>({ n: 0, at: 0 });
  const onAlphaTap = () => {
    const now = Date.now();
    taps.current =
      now - taps.current.at < 1200 ? { n: taps.current.n + 1, at: now } : { n: 1, at: now };
    if (taps.current.n >= 5) {
      taps.current = { n: 0, at: 0 };
      router.push("/vyora/founder");
    }
  };

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length <= 1) router.push("/vyora");
    else router.back();
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col bg-gray-50">
      {/* Top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-gray-200 bg-white px-4 py-3">
        {!isHome ? (
          <button
            type="button"
            onClick={goBack}
            aria-label="Back"
            className="-ml-1 rounded-lg px-2 py-1 text-gray-700 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
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
              onClick={onAlphaTap}
              aria-label="Vyora Alpha"
              className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-brand-700"
            >
              Alpha
            </button>
          </div>
        )}
        <Link
          href="/vyora/settings"
          aria-label="Data & backup"
          className="rounded-lg px-2 py-1 text-gray-600 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
        >
          ⚙
        </Link>
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
      <main className="flex-1 px-4 pb-32 pt-4">
        <GlobalSearch
          showBar={
            pathname === "/vyora" ||
            pathname === "/vyora/collect" ||
            pathname.startsWith("/vyora/parties")
          }
        />
        {children}
      </main>

      {/* Bottom action bar (safe-area aware) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 mx-auto flex w-full max-w-lg items-stretch gap-2 border-t border-gray-200 bg-white px-3 pt-2.5 print:hidden"
        style={{ paddingBottom: SAFE_BOTTOM }}
      >
        <NavIcon href="/vyora" active={isHome} label="Home" icon="🏠" />
        <NavIcon
          href="/vyora/parties"
          active={pathname.startsWith("/vyora/parties")}
          label="Contacts"
          icon="👥"
        />
        <Link
          href="/vyora/credit"
          className="flex flex-1 items-center justify-center rounded-xl bg-brand-600 px-3 py-3 text-sm font-semibold text-white hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
        >
          ＋ Credit
        </Link>
        <Link
          href="/vyora/payment"
          className="flex flex-1 items-center justify-center rounded-xl bg-emerald-600 px-3 py-3 text-sm font-semibold text-white hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        >
          ＋ Payment
        </Link>
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
        "flex min-h-[44px] w-14 flex-col items-center justify-center rounded-xl py-1 text-[11px] font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600",
        active ? "text-brand-700" : "text-gray-600"
      )}
    >
      <span className="text-lg leading-none">{icon}</span>
      {label}
    </Link>
  );
}
