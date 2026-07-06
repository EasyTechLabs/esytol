/**
 * Provider registry — the single place that lists every data provider and how to
 * connect it. New providers (Bing Webmaster, Google AdSense, revenue analytics)
 * are added here without touching the dashboard widgets or the aggregator.
 */

import * as gsc from "./searchConsole";
import * as ga from "./analytics";
import * as clarity from "./clarity";
import * as github from "./github";
import * as vercel from "./vercel";

export { fetchSearchConsole } from "./searchConsole";
export { fetchAnalytics } from "./analytics";
export { fetchClarity } from "./clarity";
export { fetchGitHub } from "./github";
export { fetchVercel } from "./vercel";

export interface ProviderMeta {
  key: string;
  label: string;
  icon: string;
  envVars: string[];
  configured: boolean;
  /** Reserved for providers not yet implemented (future-ready). */
  planned?: boolean;
}

export function providerRegistry(): ProviderMeta[] {
  return [
    {
      key: "search-console",
      label: "Google Search Console",
      icon: "🔍",
      envVars: ["GSC_SITE_URL", "GOOGLE_ACCESS_TOKEN"],
      configured: gsc.isConfigured(),
    },
    {
      key: "analytics",
      label: "Google Analytics (GA4)",
      icon: "📈",
      envVars: ["GA4_PROPERTY_ID", "GOOGLE_APPLICATION_CREDENTIALS"],
      configured: ga.isConfigured(),
    },
    {
      key: "clarity",
      label: "Microsoft Clarity",
      icon: "🖱️",
      envVars: ["CLARITY_API_TOKEN"],
      configured: clarity.isConfigured(),
    },
    {
      key: "github",
      label: "GitHub",
      icon: "🐙",
      envVars: ["GITHUB_TOKEN", "GITHUB_REPO"],
      configured: github.isConfigured(),
    },
    {
      key: "vercel",
      label: "Vercel",
      icon: "▲",
      envVars: ["VERCEL_TOKEN", "VERCEL_PROJECT_ID"],
      configured: vercel.isConfigured(),
    },
    // Future-ready — scaffolded connections, not yet implemented.
    {
      key: "bing",
      label: "Bing Webmaster Tools",
      icon: "🅱️",
      envVars: ["BING_API_KEY"],
      configured: false,
      planned: true,
    },
    {
      key: "adsense",
      label: "Google AdSense",
      icon: "💰",
      envVars: ["ADSENSE_ACCESS_TOKEN"],
      configured: false,
      planned: true,
    },
    {
      key: "revenue",
      label: "Revenue Analytics",
      icon: "📊",
      envVars: ["REVENUE_API_KEY"],
      configured: false,
      planned: true,
    },
  ];
}
