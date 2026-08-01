/**
 * Vyora — Backup module (ARCH-005).
 *
 * The merchant owns their data: take a copy out of the device, and record that
 * they did. Local-first — a backup is a file the merchant keeps, never an
 * upload.
 *
 * **No route or component yet.** The commands (ARCH-003) and the workflow
 * (ARCH-004) are complete and tested; nothing renders them. The module declares
 * the surface it owns so the gap is visible in the registry rather than
 * invisible in a backlog.
 */

import type { FeatureModule } from "./types";

export const backupModule: FeatureModule = {
  id: "backup",
  title: "Backup",
  summary: "Take a copy of your ledger off the device, as a file you keep.",
  routes: [],
  commands: ["BackupLedger", "ExportLedger"],
  selectors: [],
  components: [],
};
