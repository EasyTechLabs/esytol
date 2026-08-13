/**
 * Vyora — Shop identity module (SHOP-ONBOARDING-001).
 *
 * Sign in, create or choose a shop, show its code and QR, and check somebody
 * else's code before acting on it.
 *
 * ## Why it owns no commands
 *
 * Every other module writes to the local event log. This one does not, and the
 * omission is the point: a shop's identity is minted and held by the server,
 * because uniqueness across devices is not something an offline log can
 * promise. Two phones with no signal would each happily append a shop with the
 * same code.
 *
 * So the ledger stays local-first and this module stays server-backed, and the
 * two do not blur into each other. Nothing here is required to record money —
 * a merchant who never signs in keeps a complete book.
 */

import type { FeatureModule } from "./types";

export const shopModule: FeatureModule = {
  id: "shop",
  title: "Your shop",
  summary: "Sign in, set up your shop, and get the code and QR customers use to find it.",
  routes: [
    { path: "/vyora/shop", label: "Your shop", nav: false, icon: "🏪" },
    { path: "/vyora/shop/verify", label: "Check a shop code", nav: false, icon: "🔍" },
    { path: "/vyora/shop/people", label: "People in this shop", nav: false, icon: "👥" },
  ],
  commands: [],
  selectors: [],
  components: ["ShopSetup", "VerifyShop", "ShopQr", "People"],
};
