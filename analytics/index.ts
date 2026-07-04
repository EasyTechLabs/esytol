/**
 * Analytics infrastructure — provider-agnostic.
 *
 * No analytics provider is bundled and no tracking ID is hardcoded. Set
 * NEXT_PUBLIC_GA_ID in the environment to enable a Google Analytics 4
 * (gtag.js) integration, loaded via the <Analytics /> component. When a
 * provider is enabled, remember to allow its domains in the
 * Content-Security-Policy in next.config.ts (the default CSP blocks external
 * scripts).
 */

export const analyticsConfig = {
  gaId: process.env.NEXT_PUBLIC_GA_ID ?? "",
  enabled: Boolean(process.env.NEXT_PUBLIC_GA_ID),
} as const;

type GtagFn = (...args: unknown[]) => void;

function getGtag(): GtagFn | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { gtag?: GtagFn }).gtag;
}

/** Report a custom event. No-op unless analytics is configured. */
export function trackEvent(name: string, properties?: Record<string, unknown>): void {
  if (!analyticsConfig.enabled) return;
  getGtag()?.("event", name, properties ?? {});
}

/** Report a page view. No-op unless analytics is configured. */
export function trackPageView(path: string): void {
  if (!analyticsConfig.enabled) return;
  getGtag()?.("event", "page_view", { page_path: path });
}
