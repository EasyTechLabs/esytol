/**
 * The provider is where the clock's floor is actually restored and stored.
 *
 * `clock-ordering.test.ts` proves the mechanism; nothing there would notice if
 * `VyoraProvider` stopped seeding the clock at boot or stopped writing the floor
 * on a write. This drives the real capture path — provider, command engine,
 * event log, index engine — and pins that wiring.
 *
 * No fake timers. The floor is planted an hour ahead of the wall clock instead,
 * so every instant the clock issues afterwards is `floor + n`: deterministic,
 * and only reachable if the provider really did seed from storage.
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { VyoraProvider, useVyora } from "@/features/vyora/VyoraProvider";
import { CLOCK_KEY } from "@/lib/vyora/store";
import { readStatement } from "@/lib/vyora/ledger";

const CONTACT = "Ordering Shop";

function wrapper({ children }: { children: ReactNode }) {
  return <VyoraProvider>{children}</VyoraProvider>;
}

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  localStorage.clear();
});

async function mounted() {
  const view = renderHook(() => useVyora(), { wrapper });
  await waitFor(() => expect(view.result.current.ready).toBe(true));
  return view;
}

function partyIdFor(ledger: ReturnType<typeof useVyora>["ledger"], name: string): string {
  const party = ledger.parties.all.find((p) => p.name === name);
  if (!party) throw new Error(`no contact named ${name}`);
  return party.id;
}

describe("the provider restores the clock floor", () => {
  it("issues instants past a floor planted ahead of the wall clock", async () => {
    // Only a provider that seeded from storage can produce these.
    const floor = Date.now() + 3_600_000;
    localStorage.setItem(CLOCK_KEY, String(floor));

    const { result } = await mounted();
    act(() => {
      result.current.dispatch({
        type: "RecordCredit",
        contactName: CONTACT,
        amount: 100,
        kind: "given",
      });
    });

    const rows = readStatement(result.current.ledger, partyIdFor(result.current.ledger, CONTACT));
    expect(rows).toHaveLength(1);
    expect(Date.parse(rows[0]!.createdAt)).toBeGreaterThan(floor);
  });

  it("folds a payment before the credit that followed it", async () => {
    // The defect, driven through the real capture path rather than the
    // constructors. With the floor an hour ahead, both entries are minted from
    // it, so they land in the same millisecond region every run.
    const floor = Date.now() + 3_600_000;
    localStorage.setItem(CLOCK_KEY, String(floor));

    const { result } = await mounted();
    act(() => {
      result.current.dispatch({
        type: "RecordPayment",
        contactName: CONTACT,
        amount: 500,
        kind: "received",
      });
    });
    act(() => {
      result.current.dispatch({
        type: "RecordCredit",
        contactName: CONTACT,
        amount: 2000,
        kind: "given",
      });
    });

    const rows = readStatement(result.current.ledger, partyIdFor(result.current.ledger, CONTACT));
    expect(rows.map((r) => r.id.slice(0, 4))).toEqual(["pay_", "txn_"]);
    expect(rows.map((r) => r.runningNet)).toEqual([-500, 1500]);
  });
});

describe("the provider stores the clock floor", () => {
  it("writes it on a write, at or past the entry it stamped", async () => {
    expect(localStorage.getItem(CLOCK_KEY)).toBeNull();

    const { result } = await mounted();
    act(() => {
      result.current.dispatch({
        type: "RecordCredit",
        contactName: CONTACT,
        amount: 250,
        kind: "given",
      });
    });

    const stored = Number(localStorage.getItem(CLOCK_KEY));
    expect(Number.isFinite(stored)).toBe(true);

    const rows = readStatement(result.current.ledger, partyIdFor(result.current.ledger, CONTACT));
    expect(stored).toBeGreaterThanOrEqual(Date.parse(rows[0]!.createdAt));
  });

  it("never moves the stored floor backwards across writes", async () => {
    const { result } = await mounted();
    act(() => {
      result.current.dispatch({
        type: "RecordCredit",
        contactName: CONTACT,
        amount: 10,
        kind: "given",
      });
    });
    const first = Number(localStorage.getItem(CLOCK_KEY));

    act(() => {
      result.current.dispatch({
        type: "RecordPayment",
        contactName: CONTACT,
        amount: 5,
        kind: "received",
      });
    });
    const second = Number(localStorage.getItem(CLOCK_KEY));

    expect(second).toBeGreaterThan(first);
  });
});

describe("importing a backup and the clock floor", () => {
  /**
   * A backup carries the *exporting* device's instants. Adopting them would let
   * one machine with a wrong clock push this one permanently into the future,
   * so the floor follows only instants this browser issued. The consequence is
   * deliberate and worth seeing in a test: entries recorded after importing a
   * future-dated book sort *before* the imported ones.
   */
  const A_YEAR_AHEAD = new Date(Date.now() + 365 * 24 * 3600_000).toISOString();

  const BACKUP = JSON.stringify({
    app: "vyora",
    fileVersion: 2,
    exportedAt: A_YEAR_AHEAD,
    data: {
      parties: [{ id: "pty_imported", name: "Imported Shop", createdAt: A_YEAR_AHEAD }],
      transactions: [
        {
          id: "txn_imported",
          partyId: "pty_imported",
          amount: 700,
          kind: "given",
          date: "2027-01-01",
          createdAt: A_YEAR_AHEAD,
        },
      ],
      payments: [],
    },
  });

  it("establishes a floor on a device that had none", async () => {
    expect(localStorage.getItem(CLOCK_KEY)).toBeNull();

    const { result } = await mounted();
    act(() => {
      result.current.dispatch({ type: "ImportLedger", payload: BACKUP });
    });

    const stored = Number(localStorage.getItem(CLOCK_KEY));
    expect(Number.isFinite(stored)).toBe(true);
    expect(stored).toBeGreaterThan(0);
  });

  it("does not adopt the backup's own instants", async () => {
    const { result } = await mounted();
    act(() => {
      result.current.dispatch({ type: "ImportLedger", payload: BACKUP });
    });

    // The imported rows are stamped a year ahead. The floor must stay local.
    expect(Number(localStorage.getItem(CLOCK_KEY))).toBeLessThan(Date.parse(A_YEAR_AHEAD));
  });

  it("preserves a higher floor that was already stored", async () => {
    const floor = Date.now() + 3_600_000;
    localStorage.setItem(CLOCK_KEY, String(floor));

    const { result } = await mounted();
    act(() => {
      result.current.dispatch({ type: "ImportLedger", payload: BACKUP });
    });

    expect(Number(localStorage.getItem(CLOCK_KEY))).toBeGreaterThanOrEqual(floor);
  });

  it("leaves the floor in place when the merchant erases everything", async () => {
    const { result } = await mounted();
    act(() => {
      result.current.dispatch({
        type: "RecordCredit",
        contactName: CONTACT,
        amount: 100,
        kind: "given",
      });
    });
    const floor = Number(localStorage.getItem(CLOCK_KEY));
    expect(floor).toBeGreaterThan(0);

    act(() => {
      result.current.reset();
    });

    // Erasing the ledger must not hand the next entry an instant already spent.
    expect(Number(localStorage.getItem(CLOCK_KEY))).toBe(floor);
  });
});
