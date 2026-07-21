"use client";

/**
 * Vyora Alpha — the app shell. A slim top bar and a fixed bottom action bar so
 * recording a credit or payment is always one tap away, from any screen.
 * Phone-first; big targets; nothing to explain.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/cn";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isHome = pathname === "/vyora";

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
          <Link href="/vyora" className="flex items-center gap-2">
            <span className="text-lg font-bold text-brand-700">Vyora</span>
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-brand-700">
              Alpha
            </span>
          </Link>
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
      <main className="flex-1 px-4 pb-28 pt-4">{children}</main>

      {/* Bottom action bar */}
      <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto flex w-full max-w-lg items-stretch gap-2 border-t border-gray-200 bg-white px-3 py-2.5">
        <NavIcon href="/vyora" active={isHome} label="Home" icon="🏠" />
        <NavIcon
          href="/vyora/parties"
          active={pathname.startsWith("/vyora/parties")}
          label="Parties"
          icon="👥"
        />
        <Link
          href="/vyora/credit"
          className="flex flex-1 items-center justify-center rounded-xl bg-brand-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          ＋ Credit
        </Link>
        <Link
          href="/vyora/payment"
          className="flex flex-1 items-center justify-center rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
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
        "flex w-14 flex-col items-center justify-center rounded-xl py-1 text-[10px] font-medium",
        active ? "text-brand-700" : "text-gray-500"
      )}
    >
      <span className="text-lg leading-none">{icon}</span>
      {label}
    </Link>
  );
}
