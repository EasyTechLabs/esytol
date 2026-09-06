import type { NextConfig } from "next";

/**
 * Baseline security headers applied to every route.
 *
 * CSP note: 'unsafe-inline' is required for Next.js's inline bootstrap script,
 * the inline JSON-LD scripts, and Tailwind's inline styles. A nonce-based CSP
 * would need request-time middleware. This conservative policy blocks all
 * external sources except the minimum domains needed by the env-gated
 * <Analytics /> loader:
 *
 * Google Analytics 4 (gtag.js):
 *   - script-src : www.googletagmanager.com          (loads gtag.js)
 *   - connect-src: *.google-analytics.com,            (measurement beacons,
 *                  *.analytics.google.com,             regional + Signals)
 *                  www.googletagmanager.com
 *   - img-src    : www.google-analytics.com           (no-JS pixel fallback)
 *
 * Microsoft Clarity:
 *   - script-src : www.clarity.ms                     (loads the Clarity tag)
 *                  c.clarity.ms                        (session-recorder script)
 *                  scripts.clarity.ms                  (runtime recorder assets)
 *   - img-src    : c.clarity.ms                        (c.gif tracking pixel)
 *   - connect-src: *.clarity.ms,                       (recording/metric upload,
 *                  c.bing.com                           regional collectors +
 *                                                       Microsoft telemetry)
 *
 * No other external hosts are permitted, so security is not otherwise weakened.
 */
/**
 * `next dev` compiles modules with `eval`, for hot reload and for source maps
 * that point at your own file rather than at a bundle. A CSP without
 * `'unsafe-eval'` therefore stops the client bundle from evaluating **at all**
 * in development: React never hydrates, and every Vyora screen sits on
 * "Loading…" in a real browser while the console shows one `EvalError`.
 *
 * That went unnoticed because every web test until WEB-SYNC-004 ran in jsdom,
 * which does not enforce a Content Security Policy — so the app was untestable
 * and unusable in a real browser locally, and nothing said so.
 *
 * A production build emits no `eval`, so this is added **only** when not
 * building for production. The shipped policy is byte-for-byte what it was.
 */
const isProduction = process.env.NODE_ENV === "production";
const scriptSrc = [
  "script-src 'self' 'unsafe-inline'",
  isProduction ? null : "'unsafe-eval'",
  "https://www.googletagmanager.com https://www.clarity.ms https://c.clarity.ms https://scripts.clarity.ms",
]
  .filter(Boolean)
  .join(" ");

const contentSecurityPolicy = [
  "default-src 'self'",
  scriptSrc,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://www.google-analytics.com https://c.clarity.ms",
  "font-src 'self' data:",
  "connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://*.clarity.ms https://c.bing.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /**
   * Emit a self-contained server for the container image (ESYTOL-GCP-ALPHA-002).
   *
   * Next traces the modules each route actually imports and copies just those
   * into `.next/standalone`, so the runtime image carries a few hundred
   * megabytes instead of the whole dependency tree. On a single shared VM that
   * is the difference between a deploy that pulls in seconds and one that
   * competes with PostgreSQL for page cache while it unpacks.
   *
   * It changes nothing about how the application behaves — same server, same
   * routes, same middleware. Only what gets packaged.
   */
  output: "standalone",
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
