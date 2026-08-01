/**
 * Vyora — Import module (ARCH-005).
 *
 * Bring a previously exported ledger back onto a device. Replaces the current
 * projection; merging two ledgers is a conflict-resolution problem and is out
 * of scope until sync exists (see `VyoraEventLog.md`).
 *
 * **No route or component yet** — same as Backup: the command (ARCH-003) and
 * workflow (ARCH-004) are complete and tested, nothing renders them.
 */

import type { FeatureModule } from "./types";

export const importModule: FeatureModule = {
  id: "import",
  title: "Import",
  summary: "Restore a ledger from a file you exported earlier.",
  routes: [],
  commands: ["ImportLedger"],
  selectors: [],
  components: [],
};
