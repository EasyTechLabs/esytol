import type { Metadata } from "next";
import { VyoraProvider } from "@/features/vyora/VyoraProvider";
import { AppShell } from "@/features/vyora/AppShell";

/** Vyora Alpha — internal prototype. Not public, not indexed. */
export const metadata: Metadata = {
  title: "Vyora Alpha",
  robots: { index: false, follow: false },
};

export default function VyoraLayout({ children }: { children: React.ReactNode }) {
  return (
    <VyoraProvider>
      <AppShell>{children}</AppShell>
    </VyoraProvider>
  );
}
