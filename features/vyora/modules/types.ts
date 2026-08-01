/**
 * Vyora — the feature module contract (ARCH-005).
 *
 * A module is a **manifest of ownership**: it declares which routes, commands,
 * selectors and components belong to one feature. The core reads the manifest
 * and nothing else — it never imports a module's internals, and it has no
 * `if (module === "contacts")` anywhere.
 *
 * What a manifest is NOT: a runtime plugin loader. Next.js App Router routes are
 * filesystem-defined, so a module cannot conjure a route at runtime. What it can
 * do — and what makes this worth having — is be the single answer to "who owns
 * this?", which is exactly what lets the boundary be *tested* rather than
 * merely intended:
 *
 *  - every command in the engine is owned by exactly one module (or by core),
 *  - every declared route has a real page file behind it,
 *  - the core's navigation is assembled from manifests, not hardcoded.
 *
 * `selectors` and `components` are declared by name for the same reason. The
 * registry does not invoke them — callers import the typed function directly —
 * it records that they belong to this feature so a stray cross-module import is
 * visible instead of silent.
 */

import type { CommandType } from "@/lib/vyora/commands";

export interface ModuleRoute {
  /** The real App Router path, e.g. "/vyora/parties". */
  readonly path: string;
  /** Merchant-facing label. */
  readonly label: string;
  /** Shown in the bottom bar? */
  readonly nav: boolean;
  /** Emoji used in the nav. */
  readonly icon?: string;
}

/**
 * Named exports a module owns. Recorded, not called — the registry is an
 * ownership map, not a dependency injector.
 */
export type ModuleExports = readonly string[];

export interface FeatureModule {
  /** Stable id, unique across the registry. */
  readonly id: string;
  readonly title: string;
  /** One line: what this feature does for a merchant. */
  readonly summary: string;
  readonly routes: readonly ModuleRoute[];
  /** Commands this module owns. Every engine command must be owned exactly once. */
  readonly commands: readonly CommandType[];
  readonly selectors: ModuleExports;
  readonly components: ModuleExports;
}
