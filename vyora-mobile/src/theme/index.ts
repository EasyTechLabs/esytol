/**
 * Vyora mobile theme.
 *
 * Deliberately small and literal. The web app's visual language lives in
 * Tailwind classes that cannot cross into React Native, so this is not a port
 * of that stylesheet — it is the same decisions restated in the units this
 * runtime understands.
 *
 * Two rules drive the palette:
 *
 *   Money is never decorative. Positive and negative balances get colours that
 *   survive a cheap screen in daylight, which is where this app is actually
 *   used, rather than colours that look good on a desk monitor.
 *
 *   Nothing in the merchant-facing palette is used for developer affordances.
 *   Development-only surfaces use `dev`, so a screenshot makes it obvious which
 *   parts of the app are not for a merchant.
 */

import type { TextStyle } from "react-native";

export const colors = {
  bg: "#F7F7F8",
  surface: "#FFFFFF",
  border: "#E3E4E8",
  borderStrong: "#C9CBD2",

  text: "#16171A",
  textMuted: "#5C6070",
  textFaint: "#8A8F9E",

  /** They owe the merchant — money coming in. */
  positive: "#0F7B4F",
  /** The merchant owes — money going out. */
  negative: "#B3261E",
  settled: "#5C6070",

  accent: "#4C1D95",
  accentSoft: "#F1ECFD",

  warn: "#8A5A00",
  warnSoft: "#FFF6E0",

  /** Pending delivery: recorded here, not yet acknowledged by the server. */
  pending: "#8A5A00",
  synced: "#0F7B4F",
  failed: "#B3261E",

  /** Development-only surfaces. Never used for merchant content. */
  dev: "#4C1D95",
  devSoft: "#F1ECFD",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

/**
 * Tabular figures.
 *
 * Not cosmetic: with proportional digits a balance visibly shifts width as it
 * changes, and a column of amounts stops lining up. A merchant scanning for the
 * odd one out is doing that with their eyes, down the right-hand edge.
 *
 * Declared as a mutable array because `TextStyle["fontVariant"]` is mutable —
 * `as const` here produces a readonly tuple React Native's types reject.
 */
const TABULAR: TextStyle["fontVariant"] = ["tabular-nums"];

export const type = {
  /** A balance. */
  amount: { fontSize: 28, fontWeight: "700", fontVariant: TABULAR },
  amountSmall: { fontSize: 16, fontWeight: "600", fontVariant: TABULAR },
  title: { fontSize: 20, fontWeight: "700" },
  heading: { fontSize: 16, fontWeight: "600" },
  body: { fontSize: 15, fontWeight: "400" },
  label: { fontSize: 13, fontWeight: "500" },
  caption: { fontSize: 12, fontWeight: "400" },
} satisfies Record<string, TextStyle>;

/** Colour for a signed net, from the merchant's point of view. */
export function balanceColor(net: number): string {
  if (net > 0) return colors.positive;
  if (net < 0) return colors.negative;
  return colors.settled;
}

/**
 * The merchant's words for a position, not the API's.
 *
 * The contract says `owes_merchant`; a merchant says "they owe you". Mapping
 * happens here rather than on the server so the wording can change without a
 * contract version.
 */
export function balanceLabel(net: number): string {
  if (net > 0) return "They owe you";
  if (net < 0) return "You owe them";
  return "Settled";
}

/**
 * Whole rupees, grouped Indian-style (1,50,000 — not 150,000).
 *
 * Written out rather than delegated to `Intl` because React Native's bundled
 * ICU data varies by platform and build, and a balance that groups differently
 * on two devices is a balance a merchant will not trust.
 */
export function formatMoney(paise: number): string {
  const negative = paise < 0;
  const digits = String(Math.abs(Math.trunc(paise)));

  let grouped: string;
  if (digits.length <= 3) {
    grouped = digits;
  } else {
    const last3 = digits.slice(-3);
    const rest = digits.slice(0, -3);
    grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
  }
  return `${negative ? "−" : ""}₹${grouped}`;
}
