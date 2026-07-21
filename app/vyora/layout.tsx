import type { Metadata, Viewport } from "next";
import { ToastProvider } from "@/features/vyora/Toast";
import { VyoraProvider } from "@/features/vyora/VyoraProvider";
import { AppShell } from "@/features/vyora/AppShell";

/** Vyora Alpha — internal prototype. Not public, not indexed. */
export const metadata: Metadata = {
  title: "Vyora Alpha",
  robots: { index: false, follow: false },
};

/** Cover the notch so the safe-area insets resolve on iOS. */
export const viewport: Viewport = {
  viewportFit: "cover",
};

export default function VyoraLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <VyoraProvider>
        <AppShell>{children}</AppShell>
      </VyoraProvider>
    </ToastProvider>
  );
}
