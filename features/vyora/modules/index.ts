/**
 * Vyora — the feature module registry (ARCH-005).
 *
 * The one place that knows which modules exist. Core reads this; core never
 * imports a module file. Adding a feature means adding its manifest here and
 * nothing else — no switch statement in the shell, no route table to update by
 * hand.
 */

import type { CommandType } from "@/lib/vyora/commands";
import type { FeatureModule, ModuleRoute } from "./types";
import { contactsModule } from "./contacts";
import { backupModule } from "./backup";
import { importModule } from "./importLedger";
import { founderModule } from "./founder";
import { recoveryModule } from "./recovery";
import { settingsModule } from "./settings";
import { closingModule } from "./closing";

export type { FeatureModule, ModuleRoute } from "./types";

/**
 * Commands that belong to the core capture loop rather than to any feature.
 *
 * Recording a credit or a payment, correcting a mistake and putting it back is
 * what Vyora *is* — it is not a feature that could be unplugged, so it is not a
 * module. Listing it here keeps the ownership map total: every command in the
 * engine is accounted for by exactly one owner.
 */
export const CORE_COMMANDS: readonly CommandType[] = [
  "RecordCredit",
  "RecordPayment",
  "DeleteEntry",
  "RestoreEntry",
];

/**
 * Routes the core owns — the dashboard, the two capture screens, and More.
 *
 * The bottom bar carries exactly four destinations (V2-006): Home, Chase,
 * Parties, More. Capture stays as two floating buttons, because recording money
 * is not navigation — it is the thing the merchant came to do.
 */
export const MORE_PATH = "/vyora/more";

export const CORE_ROUTES: readonly ModuleRoute[] = [
  { path: "/vyora", label: "Home", nav: true, icon: "🏠" },
  { path: "/vyora/credit", label: "Credit", nav: false },
  { path: "/vyora/payment", label: "Payment", nav: false },
  { path: "/vyora/more", label: "More", nav: true, icon: "☰" },
];

/**
 * Everything reachable from More: any route a module declares that is not in
 * the bar and is not a detail page. Assembled from manifests, so a new module
 * appears there without this file being edited.
 */
export function moreRoutes(): readonly ModuleRoute[] {
  return MODULES.flatMap((module) => module.routes).filter(
    (route) => !route.nav && !route.path.includes("[")
  );
}

/** Every registered module, in the order they should appear. */
export const MODULES: readonly FeatureModule[] = [
  recoveryModule,
  closingModule,
  contactsModule,
  importModule,
  backupModule,
  settingsModule,
  founderModule,
];

/** Look a module up by id, or undefined. */
export function findModule(id: string): FeatureModule | undefined {
  return MODULES.find((module) => module.id === id);
}

/** Which module owns a command, or "core". Undefined means nobody claimed it. */
export function ownerOfCommand(command: CommandType): string | undefined {
  if (CORE_COMMANDS.includes(command)) return "core";
  return MODULES.find((module) => module.commands.includes(command))?.id;
}

/** Every route the app has, core and modules together. */
export function allRoutes(): readonly ModuleRoute[] {
  return [...CORE_ROUTES, ...MODULES.flatMap((module) => module.routes)];
}

/**
 * The bottom-bar entries, assembled from manifests.
 *
 * This is what makes "core knows nothing about module internals" real rather
 * than aspirational: the shell renders whatever the registry declares, and a
 * new module appears in the nav without the shell being edited.
 */
export function navRoutes(): readonly ModuleRoute[] {
  const inBar = allRoutes().filter((route) => route.nav);
  // Home first, More last, features in registry order between them. "More" is
  // a drawer, not a destination, so it belongs at the end of the thumb's sweep.
  const more = inBar.filter((route) => route.path === MORE_PATH);
  const rest = inBar.filter((route) => route.path !== MORE_PATH);
  return [...rest, ...more];
}
