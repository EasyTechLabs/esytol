/**
 * Vyora Alpha — display formatting. Indian rupee grouping + plain-language dates,
 * so a tired shopkeeper reads a screen in under five seconds.
 */

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** ₹1,80,000 — Indian digit grouping, no paise. */
export function formatMoney(n: number): string {
  return `₹${inr.format(Math.abs(Math.round(n)))}`;
}

/** A signed money string with sign hint for statements (e.g. "+ ₹1,850"). */
export function formatSigned(n: number): string {
  const sign = n > 0 ? "+ " : n < 0 ? "− " : "";
  return `${sign}${formatMoney(n)}`;
}

/** "They owe you" / "You owe them" / "Settled" from a signed net. */
export function balanceLabel(net: number): "They owe you" | "You owe them" | "Settled" {
  if (net > 0) return "They owe you";
  if (net < 0) return "You owe them";
  return "Settled";
}

/** Tailwind text colour for a signed net (green = coming in, red = going out). */
export function balanceColor(net: number): string {
  if (net > 0) return "text-emerald-600";
  if (net < 0) return "text-red-600";
  return "text-gray-500";
}

/** "Today", "Yesterday", or "12 Jul 2026". Keeps recent activity human. */
export function formatDate(iso: string, now: Date = new Date()): string {
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dayMs = 86_400_000;
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / dayMs);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
