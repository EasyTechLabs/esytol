import Link from "next/link";
import { Navigation } from "./Navigation";
import { Logo } from "./Logo";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur-sm">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="font-bold text-gray-900" aria-label="Esytol home">
          <Logo />
        </Link>

        {/* Navigation */}
        <Navigation />

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Link
            href="/tools"
            className="hidden rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 sm:block"
          >
            All Tools
          </Link>
        </div>
      </div>
    </header>
  );
}
