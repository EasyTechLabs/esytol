/**
 * Analytics stub — wire up Google Analytics or Plausible here.
 * Configure NEXT_PUBLIC_GA_ID in .env.local to enable.
 */

export function trackEvent(_name: string, _properties?: Record<string, unknown>): void {
  if (process.env.NODE_ENV !== "production") return;
  // TODO: implement analytics provider
}

export function trackPageView(_path: string): void {
  if (process.env.NODE_ENV !== "production") return;
  // TODO: implement page view tracking
}
