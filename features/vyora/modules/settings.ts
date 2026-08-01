/**
 * Vyora — Settings module (V2-002).
 *
 * The merchant trust page: is my data safe, take a copy, restore a copy, and
 * the business profile. Not a preferences screen — the honest backup status is
 * the reason it exists.
 *
 * Owns the destructive surface too, behind typed confirmation.
 *
 * Not in the bottom bar since V2-006 — it lives under More, because a bar with
 * six destinations is a bar a thumb cannot hit.
 */

import type { FeatureModule } from "./types";

export const settingsModule: FeatureModule = {
  id: "settings",
  title: "Settings",
  summary: "Know your data is safe, keep a copy, and restore it if you ever need to.",
  routes: [{ path: "/vyora/settings", label: "Settings", nav: false, icon: "⚙️" }],
  commands: [],
  selectors: ["backupStatus", "previewImport", "loadSettings", "saveSettings"],
  components: ["Settings"],
};
