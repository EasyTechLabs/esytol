import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "404 — Page Not Found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
      <span className="text-6xl">🔍</span>
      <div className="space-y-2">
        <h1 className="text-4xl font-bold text-gray-900">404</h1>
        <p className="text-lg text-gray-600">This page doesn&apos;t exist.</p>
      </div>
      <p className="max-w-md text-gray-500">
        The tool or page you&apos;re looking for may have moved or been renamed.
      </p>
      <div className="flex gap-3">
        <Link
          href="/"
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700"
        >
          Go Home
        </Link>
        <Link
          href="/tools"
          className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          Browse All Tools
        </Link>
      </div>
    </div>
  );
}
