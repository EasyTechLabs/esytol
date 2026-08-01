/**
 * Vyora — Recovery module (V2-001).
 *
 * "Who to chase today": the ranked list of people who owe the merchant, with
 * everything needed to make the call on one screen.
 *
 * Owns `RecordReminder` — which records that the MERCHANT followed up. Vyora
 * sends nothing: recovery here is one-way, merchant-sent and relationship-safe,
 * never automated dunning.
 *
 * The first consumer of `DueIndex`, built in ARCH-001 and unused until now.
 */

import type { FeatureModule } from "./types";

export const recoveryModule: FeatureModule = {
  id: "recovery",
  title: "Recovery",
  summary: "Know who to call first, what they owe, how late it is, and what to say.",
  routes: [{ path: "/vyora/recovery", label: "Chase", nav: true, icon: "📢" }],
  commands: ["RecordReminder"],
  selectors: ["buildRecoveryList", "recoveryTotals", "buildReminderMessage"],
  components: ["Recovery"],
};
