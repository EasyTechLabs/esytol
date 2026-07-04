/**
 * Ads stub — configure Google AdSense or another ad provider here.
 * Set NEXT_PUBLIC_ADSENSE_ID in .env.local to enable.
 */

export const adsConfig = {
  adsenseId: process.env.NEXT_PUBLIC_ADSENSE_ID ?? "",
  enabled: Boolean(process.env.NEXT_PUBLIC_ADSENSE_ID),
} as const;

export type AdSlot = "header" | "sidebar" | "in-content" | "footer";
