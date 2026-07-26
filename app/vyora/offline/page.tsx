import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Offline · Vyora",
  robots: { index: false, follow: false },
};

/**
 * The offline shell (ENG-006). Served by the service worker when a navigation is
 * attempted with no network and no cached page. Vyora's data is local, so the app
 * itself keeps working once loaded — this only shows if a page couldn't be reached.
 */
export default function OfflinePage() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <div
        aria-hidden
        className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-2xl"
      >
        📴
      </div>
      <div>
        <h1 className="text-lg font-semibold text-gray-900">You&rsquo;re offline</h1>
        <p className="mx-auto mt-1 max-w-xs text-sm text-gray-600">
          Vyora works offline once it&rsquo;s loaded, and your ledger is safe on this device.
          Reconnect to sync any updates.
        </p>
      </div>
      <Link
        href="/vyora"
        className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
      >
        Go to home
      </Link>
    </div>
  );
}
