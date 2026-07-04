import type { Metadata, Viewport } from "next";
import { fontSans, fontMono } from "@/styles/fonts";
import { cn } from "@/lib/cn";
import { buildMetadata } from "@/seo/metadata";
import { webSiteSchema, organizationSchema } from "@/seo/jsonld";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
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
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
