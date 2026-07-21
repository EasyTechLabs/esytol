/**
 * Vyora Alpha — display formatting. Indian rupee grouping + plain-language dates
 * by default, so a tired shopkeeper reads a screen in under five seconds. The
 * currency symbol, digit grouping, and date style are driven by the merchant's
 * settings (P3-002) via `configureFormat` — called once from the provider on load
 * and on every settings change. Defaults are ₹ / Indian grouping / relative dates,
 * so server-render and tests behave exactly as before.
 */

import type { DateFormatPref, NumberFormatPref } from "./types";

/** Currency code → symbol. Vyora is rupee-first; a few neighbours are offered too. */
export const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
  AED: "د.إ",
  BDT: "৳",
  NPR: "रू",
  PKR: "₨",
  LKR: "රු",
};

const cfg: { symbol: string; locale: string; dateFormat: DateFormatPref } = {
  symbol: "₹",
  locale: "en-IN",
  dateFormat: "relative",
};
let grouping = new Intl.NumberFormat(cfg.locale, { maximumFractionDigits: 0 });

/** Apply the merchant's format preferences (P3-002). Safe to call repeatedly. */
export function configureFormat(prefs: {
  currency?: string;
  numberFormat?: NumberFormatPref;
  dateFormat?: DateFormatPref;
}): void {
  if (prefs.currency) cfg.symbol = CURRENCY_SYMBOLS[prefs.currency] ?? cfg.symbol;
  if (prefs.numberFormat) cfg.locale = prefs.numberFormat === "international" ? "en-US" : "en-IN";
  if (prefs.dateFormat) cfg.dateFormat = prefs.dateFormat;
  grouping = new Intl.NumberFormat(cfg.locale, { maximumFractionDigits: 0 });
}

/** ₹1,80,000 — merchant's currency symbol + digit grouping, no paise. */
export function formatMoney(n: number): string {
  return `${cfg.symbol}${grouping.format(Math.abs(Math.round(n)))}`;
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

/** Semantic token colour for a signed net (positive = coming in, negative = going out). */
export function balanceColor(net: number): string {
  if (net > 0) return "text-positive";
  if (net < 0) return "text-negative";
  return "text-gray-500";
}

/** "12 Jul 2026, 3:40 PM" — a precise timestamp (used for the last-backup time). */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * A human date, styled per the merchant's date-format preference (P3-002):
 * "relative" → Today / Yesterday / 12 Jul 2026 (default), "dmy" → always 12 Jul 2026,
 * "iso" → 2026-07-12.
 */
export function formatDate(iso: string, now: Date = new Date()): string {
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  if (cfg.dateFormat === "iso") {
    const p = (x: number) => String(x).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  const longDate = () =>
    d.toLocaleDateString(cfg.locale, { day: "numeric", month: "short", year: "numeric" });
  if (cfg.dateFormat === "dmy") return longDate();
  const dayMs = 86_400_000;
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / dayMs);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return longDate();
}
