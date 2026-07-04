import type { Metadata } from "next";
import { siteConfig } from "@/config/site";

interface MetadataOptions {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  noIndex?: boolean;
}

export function buildMetadata({
  title,
  description,
  path = "/",
  image,
  noIndex = false,
}: MetadataOptions = {}): Metadata {
  const resolvedTitle = title ? `${title} — ${siteConfig.name}` : siteConfig.name;
  const resolvedDescription = description ?? siteConfig.description;
  const resolvedUrl = `${siteConfig.url}${path}`;
  const resolvedImage = image ?? siteConfig.ogImage;

  return {
    title: resolvedTitle,
    description: resolvedDescription,
    keywords: siteConfig.keywords,
    metadataBase: new URL(siteConfig.url),
    alternates: { canonical: resolvedUrl },
    robots: noIndex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      title: resolvedTitle,
      description: resolvedDescription,
      url: resolvedUrl,
      siteName: siteConfig.name,
      images: [{ url: resolvedImage, width: 1200, height: 630, alt: resolvedTitle }],
      type: "website",
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: resolvedTitle,
      description: resolvedDescription,
      images: [resolvedImage],
    },
  };
}
