"use client";

/**
 * Vyora Alpha — the one client store the whole app reads and writes through.
 *
 * Loads the merchant's data from localStorage on mount, exposes it plus a tiny
 * set of actions, and persists after every change. Pure domain logic lives in
 * lib/vyora; this only wires it to React state. No server, no network.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { VyoraData, Party, EntryKind, PaymentKind } from "@/lib/vyora/types";
import {
  emptyData,
  loadData,
  saveData,
  addParty as addPartyMut,
  addTransaction as addTxnMut,
  addPayment as addPayMut,
  getOrCreateParty as getOrCreatePartyMut,
  deleteEntry as deleteEntryMut,
  clearData,
} from "@/lib/vyora/store";

interface CreditInput {
  partyName: string;
  amount: number;
  kind: EntryKind;
  description?: string;
  date?: string;
  dueDate?: string;
}
interface PaymentInput {
  partyName: string;
  amount: number;
  kind: PaymentKind;
  note?: string;
  date?: string;
}

interface VyoraContextValue {
  /** True once localStorage has been read (avoids SSR/hydration flash). */
  ready: boolean;
  data: VyoraData;
  /** Record a credit; creates the party by name if new. Returns the party. */
  recordCredit: (input: CreditInput) => Party;
  /** Record a payment; creates the party by name if new. Returns the party. */
  recordPayment: (input: PaymentInput) => Party;
  /** Create (or reuse) a party explicitly. */
  createParty: (input: { name: string; phone?: string; note?: string }) => Party;
  /** Delete one entry (fix a mistake). */
  deleteEntry: (id: string) => void;
  /** Erase everything on this device (with confirmation in the UI). */
  reset: () => void;
}

const VyoraContext = createContext<VyoraContextValue | null>(null);

export function VyoraProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<VyoraData>(emptyData);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setData(loadData());
    setReady(true);
  }, []);

  const commit = useCallback((next: VyoraData) => {
    setData(next);
    saveData(next);
  }, []);

  const recordCredit = useCallback(
    (input: CreditInput): Party => {
      const created = getOrCreatePartyMut(data, input.partyName);
      const { data: withTxn } = addTxnMut(created.data, {
        partyId: created.party.id,
        amount: input.amount,
        kind: input.kind,
        description: input.description,
        date: input.date,
        dueDate: input.dueDate,
      });
      commit(withTxn);
      return created.party;
    },
    [data, commit]
  );

  const recordPayment = useCallback(
    (input: PaymentInput): Party => {
      const created = getOrCreatePartyMut(data, input.partyName);
      const { data: withPay } = addPayMut(created.data, {
        partyId: created.party.id,
        amount: input.amount,
        kind: input.kind,
        note: input.note,
        date: input.date,
      });
      commit(withPay);
      return created.party;
    },
    [data, commit]
  );

  const createParty = useCallback(
    (input: { name: string; phone?: string; note?: string }): Party => {
      const { data: next, party } = addPartyMut(data, input);
      commit(next);
      return party;
    },
    [data, commit]
  );

  const deleteEntry = useCallback(
    (id: string) => {
      commit(deleteEntryMut(data, id));
    },
    [data, commit]
  );

  const reset = useCallback(() => {
    clearData();
    setData(emptyData());
  }, []);

  const value = useMemo<VyoraContextValue>(
    () => ({ ready, data, recordCredit, recordPayment, createParty, deleteEntry, reset }),
    [ready, data, recordCredit, recordPayment, createParty, deleteEntry, reset]
  );

  return <VyoraContext.Provider value={value}>{children}</VyoraContext.Provider>;
}

export function useVyora(): VyoraContextValue {
  const ctx = useContext(VyoraContext);
  if (!ctx) throw new Error("useVyora must be used within <VyoraProvider>");
  return ctx;
}
