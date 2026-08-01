"use client";

/**
 * Vyora — More (V2-006).
 *
 * Everything that is not a dozens-of-times-a-day journey. The list is built
 * from the module registry, so a new feature appears here without this screen
 * being edited.
 */

import Link from "next/link";
import { moreRoutes } from "../modules";

export function More() {
  const routes = moreRoutes();

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-gray-900">More</h1>
      <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
        {routes.map((route) => (
          <Link
            key={route.path}
            href={route.path}
            className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50"
          >
            <span className="text-xl leading-none">{route.icon ?? "•"}</span>
            <span className="flex-1 text-base font-medium text-gray-800">{route.label}</span>
            <span className="text-gray-300">›</span>
          </Link>
        ))}
      </div>
      <p className="px-1 text-xs text-gray-400">
        Your data stays on this device. Nothing here sends anything anywhere.
      </p>
    </div>
  );
}
