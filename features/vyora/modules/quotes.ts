/**
 * Vyora — Item lists (ITEM-QUOTE-001).
 *
 * A customer writes down what they want; the shop prices it; both agree; then
 * it becomes credit or a receipt for money paid outside Vyora.
 *
 * ## Why it owns no commands
 *
 * Like proposals, this module authors no ledger event. A list is not a debt,
 * and the two things that can come out of one are recorded elsewhere: an
 * ordinary credit proposal, or an audit-only `BillSettled` that moves no
 * balance at all. See ADR-0014.
 */

import type { FeatureModule } from "./types";

export const quotesModule: FeatureModule = {
  id: "quotes",
  title: "Item lists",
  summary:
    "Send a shop a list of what you want, or price a customer's. Nothing enters a book until you both agree — and a bill paid in cash or UPI is recorded as a receipt, not as money off an older debt.",
  routes: [{ path: "/vyora/lists", label: "Item lists", nav: false, icon: "📝" }],
  commands: [],
  selectors: [],
  components: ["Quotes"],
};
