/** Formatting + deterministic-seed helpers for the Growth Dashboard. */

export function formatNumber(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${Math.round(n)}`;
}

export function formatFull(n: number): string {
  return new Intl.NumberFormat("en-IN").format(Math.round(n));
}

export function formatPercent(fraction: number, dp = 1): string {
  return `${(fraction * 100).toFixed(dp)}%`;
}

export function formatPosition(p: number): string {
  return p.toFixed(1);
}

export function formatDurationSec(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

export function formatDelta(pct: number): string {
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

export function relativeTime(iso: string, now: Date): string {
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now.getTime() - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

// ── Deterministic seeds (no Math.random — stable across builds) ────────────────

export function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic 0..1 from a string + salt. */
export function seededUnit(str: string, salt = ""): number {
  return hashString(`${str}::${salt}`) / 0xffffffff;
}

/** Deterministic integer in [min, max] from a string + salt. */
export function seededInt(str: string, min: number, max: number, salt = ""): number {
  return Math.round(min + seededUnit(str, salt) * (max - min));
}
