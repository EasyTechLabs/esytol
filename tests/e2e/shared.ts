/**
 * What the setup project hands to every test (WEB-SYNC-004).
 *
 * Two files under `tests/e2e/.auth`, written once per run and gitignored: the
 * browser state Playwright restores into each context, and the shop the whole
 * suite works in.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = join(process.cwd(), "tests", "e2e", ".auth");

export const AUTH_STATE = join(DIR, "state.json");
export const SHOP_FILE = join(DIR, "shop.json");

export interface SuiteShop {
  readonly email: string;
  readonly shopId: string;
  readonly merchantId: string;
  readonly token: string;
  readonly deviceId: string;
}

export function suiteShop(): SuiteShop {
  return JSON.parse(readFileSync(SHOP_FILE, "utf8")) as SuiteShop;
}
