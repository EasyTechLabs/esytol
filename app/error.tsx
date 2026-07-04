"use client";

import { useEffect } from "react";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error("[Esytol Error]", error);
  }, [error]);

  return (
    <div className="container-page flex min-h-[40vh] flex-col items-center justify-center gap-5 text-center">
      <span className="text-5xl">⚠️</span>
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-gray-900">Something went wrong</h2>
        <p className="text-sm text-gray-500">{error.message ?? "An unexpected error occurred."}</p>
      </div>
      <button
        onClick={reset}
        className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700"
      >
        Try again
      </button>
    </div>
  );
}
