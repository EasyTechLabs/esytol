/**
 * Vyora — Contacts module (ARCH-005).
 *
 * Everyone the merchant deals with — customer, supplier, or both at once, since
 * direction is a property of each entry rather than a fixed role. Owns the
 * contact list, per-contact statement, and the create/delete commands.
 *
 * Note: the code still says "Party" internally while the product language says
 * "Contact". That divergence predates this module and is deliberately left
 * alone here — renaming the domain is not an ARCH-005 change.
 */

import type { FeatureModule } from "./types";

export const contactsModule: FeatureModule = {
  id: "contacts",
  title: "Contacts",
  summary: "Find anyone and read their full statement.",
  routes: [
    // Label deliberately matches the screen's own copy ("Search parties…", "Add
    // a party") rather than the product term. Renaming is a separate change and
    // half a rename reads worse than none.
    { path: "/vyora/parties", label: "Parties", nav: true, icon: "👥" },
    { path: "/vyora/parties/[id]", label: "Statement", nav: false },
  ],
  commands: ["CreateContact", "DeleteContact"],
  selectors: ["readSearch", "readParty", "readPartyByName", "readPartyNet", "readStatement"],
  components: ["Parties", "PartyStatement", "PartyPicker"],
};
