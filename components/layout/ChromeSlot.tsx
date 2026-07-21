"use client";

/**
 * Renders the public-site chrome (Header / Footer / CommandPalette) everywhere
 * EXCEPT the Vyora Alpha app, which has its own full-screen shell. Keeps the
 * internal prototype visually separate from the public product with zero
 * restructuring. `usePathname` resolves during SSR too, so there is no flash.
 */

import { usePathname } from "next/navigation";

export function ChromeSlot({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/vyora")) return null;
  return <>{children}</>;
}
