/**
 * Vyora — Daily Closing module (V2-004).
 *
 * The end-of-day screen: what came in, what went out, who to chase tomorrow,
 * and a signed-off record of it.
 *
 * Owns `CloseDay`, which is audit-only — closing a day moves no balance and
 * recomputes nothing.
 *
 * Not in the bottom bar since V2-006 — it lives under More. Closing is a
 * once-a-day journey; the bar is for the ones taken dozens of times.
 */

import type { FeatureModule } from "./types";

export const closingModule: FeatureModule = {
  id: "closing",
  title: "Daily closing",
  summary: "Finish the day in half a minute: today's money, and tomorrow's collections.",
  routes: [{ path: "/vyora/closing", label: "Closing", nav: false, icon: "🌙" }],
  commands: ["CloseDay"],
  selectors: ["buildDailyClosing", "closingHistory"],
  components: ["Closing"],
};
