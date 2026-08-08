/**
 * Vyora — the Party read boundary.
 *
 * A seam, not a rewrite. Today every party read goes through the Ledger's
 * indexes (`readSearch`, `readParty`); this names that shape so a second
 * implementation can exist beside it without any screen learning where its data
 * came from.
 *
 * Reads only. There is deliberately no create, update, delete or sync here:
 * writes stay on the local command path, which is the merchant's actual book.
 * A write boundary would let a development experiment mutate a pilot ledger,
 * and no amount of care around it is worth that risk while the flag is a
 * developer convenience.
 *
 * The local implementation is the default and stays the default. The remote one
 * is a development aid for checking that the API returns what the web app
 * expects — see `docs/platform/web-party-read-integration.md`.
 */

import type { Party, PartyBalance } from "./types";
import type { Ledger } from "./ledger";
import { readParty, readPartyNet, readSearch } from "./ledger";

/** Where a party read came from. Surfaced so a developer can tell at a glance. */
export type PartySourceKind = "local" | "remote";

export interface PartyRead {
  readonly party: Party;
  readonly net: number;
}

export interface PartySource {
  readonly kind: PartySourceKind;
  /** Search/list. `query` empty means "everything", matching `readSearch`. */
  list(query: string): Promise<readonly PartyBalance[]>;
  /** One party plus its net, or null when this source does not have it. */
  get(partyId: string): Promise<PartyRead | null>;
}

/**
 * The default, and the one the pilot ships with.
 *
 * Async only because the interface is — the ledger is already in memory, so
 * this resolves immediately and costs nothing.
 */
export function localPartySource(ledger: Ledger): PartySource {
  return {
    kind: "local",
    async list(query: string) {
      return readSearch(ledger, query);
    },
    async get(partyId: string) {
      const party = readParty(ledger, partyId);
      if (!party) return null;
      return { party, net: readPartyNet(ledger, partyId) };
    },
  };
}
