import type { Metadata, Viewport } from "next";
import { VyoraProvider } from "@/features/vyora/VyoraProvider";
import { AppShell } from "@/features/vyora/AppShell";

/**
 * Vyora Alpha — internal prototype. Not public, not indexed.
 *
 * The manifest and theme are declared HERE rather than in the root layout, so
 * installability applies to /vyora only and the rest of the esytol site is
 * untouched.
 */
export const metadata: Metadata = {
  title: "Vyora Alpha",
  robots: { index: false, follow: false },
  manifest: "/vyora/manifest.webmanifest",
  applicationName: "Vyora",
  appleWebApp: {
    capable: true,
    title: "Vyora",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/vyora/icon.svg",
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  // Installed apps run under the notch and the home indicator.
  viewportFit: "cover",
};

export default function VyoraLayout({ children }: { children: React.ReactNode }) {
  return (
    <VyoraProvider>
      <AppShell>{children}</AppShell>
    </VyoraProvider>
  );
}
