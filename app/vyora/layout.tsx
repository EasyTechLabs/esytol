import type { Metadata, Viewport } from "next";
import { ToastProvider } from "@/features/vyora/Toast";
import { VyoraProvider } from "@/features/vyora/VyoraProvider";
import { AppShell } from "@/features/vyora/AppShell";
import { ServiceWorkerManager } from "@/features/vyora/ServiceWorkerManager";

/** Vyora Alpha — internal prototype. Not public, not indexed. Installable PWA (ENG-006). */
export const metadata: Metadata = {
  title: "Vyora Alpha",
  robots: { index: false, follow: false },
  manifest: "/vyora/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Vyora" },
  icons: {
    icon: [
      { url: "/vyora/icon.svg", type: "image/svg+xml" },
      { url: "/vyora/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/vyora/apple-touch-icon.png", sizes: "180x180" }],
  },
};

/** Cover the notch so the safe-area insets resolve on iOS; brand the status bar. */
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#2563eb",
};

export default function VyoraLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <VyoraProvider>
        <AppShell>{children}</AppShell>
        <ServiceWorkerManager />
      </VyoraProvider>
    </ToastProvider>
  );
}
