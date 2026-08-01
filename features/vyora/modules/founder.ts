/**
 * Vyora — Founder Mode module (ENG-008).
 *
 * Hidden, local-only diagnostics: ledger totals, device storage, integrity
 * checks and the performance timeline. Reached by tapping the "Alpha" badge
 * five times — deliberately not in the navigation.
 *
 * Owns no commands: it only reads. That is the point — a diagnostics surface
 * that could change the ledger would be a diagnostics surface nobody should
 * trust.
 *
 * This is the first module added through the ARCH-005 registry rather than by
 * editing the shell.
 */

import type { FeatureModule } from "./types";

export const founderModule: FeatureModule = {
  id: "founder",
  title: "Founder Mode",
  summary: "Hidden local diagnostics: totals, storage, integrity and timings.",
  routes: [{ path: "/vyora/founder", label: "Founder", nav: false }],
  commands: [],
  selectors: ["timingSummary", "debugRecords", "runIntegrityChecks", "storageSizeBytes"],
  components: ["FounderMode"],
};
