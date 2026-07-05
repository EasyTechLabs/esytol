import type { NextConfig } from "next";

/**
 * Baseline security headers applied to every route.
 *
 * CSP note: 'unsafe-inline' is required for Next.js's inline bootstrap script,
 * the inline JSON-LD scripts, and Tailwind's inline styles. A nonce-based CSP
 * would need request-time middleware; this conservative policy blocks all
 * external sources except the minimum Google Analytics 4 (gtag.js) domains
 * needed for the env-gated <Analytics /> loader:
 *   - script-src : www.googletagmanager.com          (loads gtag.js)
 *   - connect-src: *.google-analytics.com,            (measurement beacons,
 *                  *.analytics.google.com,             regional + Signals)
 *                  www.googletagmanager.com
 *   - img-src    : www.google-analytics.com           (no-JS pixel fallback)
 * No other external hosts are permitted, so security is not otherwise weakened.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://www.google-analytics.com",
  "font-src 'self' data:",
  "connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com",
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
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
