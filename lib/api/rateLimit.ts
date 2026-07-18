/**
 * Rate limiting — EXPOSE-001.
 *
 * A configurable, in-memory sliding-window limiter. The default is deliberately
 * generous (a public compute API); there are no hardcoded business limits — the
 * config is the single source of truth and can be raised/lowered without code.
 *
 * Note (honest limitation): on serverless (Vercel) each instance holds its own
 * window, so this is best-effort per-instance protection, not a global quota.
 * A distributed limiter (Redis/Upstash) is out of scope until it is needed.
 */

export interface RateLimitConfig {
  /** Max requests allowed per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

/** Generous public default: 60 requests/minute per client. Override via config. */
export const DEFAULT_RATE_LIMIT: RateLimitConfig = { limit: 60, windowMs: 60_000 };

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Milliseconds until the window resets. */
  resetMs: number;
}

// key → timestamps (ms) of requests within the current window.
const hits = new Map<string, number[]>();

/**
 * Check and record a request against the limiter. `now` is injectable so the
 * limiter stays testable and deterministic.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig = DEFAULT_RATE_LIMIT,
  now: number = Date.now()
): RateLimitResult {
  const windowStart = now - config.windowMs;
  const recent = (hits.get(key) ?? []).filter((t) => t > windowStart);

  if (recent.length >= config.limit) {
    const oldest = recent[0];
    hits.set(key, recent);
    return {
      allowed: false,
      limit: config.limit,
      remaining: 0,
      resetMs: Math.max(0, oldest + config.windowMs - now),
    };
  }

  recent.push(now);
  hits.set(key, recent);
  return {
    allowed: true,
    limit: config.limit,
    remaining: config.limit - recent.length,
    resetMs: config.windowMs,
  };
}

/** Standard rate-limit response headers. */
export function rateLimitHeaders(r: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(r.limit),
    "X-RateLimit-Remaining": String(r.remaining),
    "X-RateLimit-Reset": String(Math.ceil(r.resetMs / 1000)),
  };
}

/** Clear all counters — for tests. */
export function resetRateLimits(): void {
  hits.clear();
}

/** Derive a client key from the request (best-effort IP; falls back to a constant). */
export function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "anonymous";
}
