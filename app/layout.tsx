import type { Metadata, Viewport } from "next";
import { fontSans, fontMono } from "@/styles/fonts";
import { cn } from "@/lib/cn";
import { buildMetadata } from "@/seo/metadata";
import { webSiteSchema, organizationSchema } from "@/seo/jsonld";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ChromeSlot } from "@/components/layout/ChromeSlot";
import { Analytics } from "@/analytics/Analytics";
import { CommandPalette } from "@/features/search/CommandPalette";
import "./globals.css";

export const metadata: Metadata = buildMetadata();

export const viewport: Viewport = {
  themeColor: "#3b82f6",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteSchema()) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema()) }}
        />
      </head>
      <body
        className={cn(
          fontSans.variable,
          fontMono.variable,
          "flex min-h-screen flex-col bg-gray-50 font-sans"
        )}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
        >
          Skip to content
        </a>
        <ChromeSlot>
          <Header />
        </ChromeSlot>
        <main id="main-content" tabIndex={-1} className="flex-1">
          {children}
        </main>
        <ChromeSlot>
          <Footer />
        </ChromeSlot>
        <ChromeSlot>
          <CommandPalette />
        </ChromeSlot>
        {/* Vyora Alpha carries no external tracking — analytics is suppressed on /vyora. */}
        <ChromeSlot>
          <Analytics />
        </ChromeSlot>
      </body>
    </html>
  );
}
