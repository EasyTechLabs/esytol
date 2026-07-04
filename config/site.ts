export const siteConfig = {
  name: "Esytol",
  tagline: "5000+ free online tools — one platform.",
  description:
    "Esytol is a free platform with 5000+ online tools for developers, designers, writers, and everyday users. Fast, private, and always available.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://esytol.com",
  ogImage: "/og-default.png",
  links: {
    github: "https://github.com/EasyTechLabs/esytol",
  },
  keywords: [
    "online tools",
    "free tools",
    "developer tools",
    "text tools",
    "converter",
    "formatter",
    "generator",
    "encoder",
    "esytol",
  ],
} as const;

export type SiteConfig = typeof siteConfig;
