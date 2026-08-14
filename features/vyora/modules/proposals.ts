/**
 * Vyora — Requests (FINANCIAL-PROPOSALS-UI-001).
 *
 * Credit, payments and advances that two people agree to before either book
 * records them.
 *
 * ## Why it owns no commands
 *
 * Every ledger module writes to the local event log. This one cannot: a
 * proposal is a negotiation between two people who are not at the same screen,
 * and an offline log has no way to know the other side agreed. The entry it
 * eventually produces *is* an ordinary ledger event — written by the server on
 * acceptance and delivered by sync — so nothing here bypasses the log; it
 * simply does not author it.
 *
 * The ledger stays local-first and untouched. A merchant who never sends a
 * request keeps a complete book, and recording an entry directly never goes
 * near any of this.
 */

import type { FeatureModule } from "./types";

export const proposalsModule: FeatureModule = {
  id: "proposals",
  title: "Requests",
  summary:
    "Ask a customer to agree a credit, a payment or an advance — and answer the ones sent to you. Nothing enters either book until both of you agree.",
  routes: [{ path: "/vyora/requests", label: "Requests", nav: false, icon: "🤝" }],
  commands: [],
  selectors: [],
  components: ["Proposals"],
};
