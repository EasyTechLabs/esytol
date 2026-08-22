/**
 * Putting back an entry the merchant just removed
 * (ENTRY-RESTORE-FUNCTIONALITY-001).
 *
 * `RestoreEntry` has existed in the command engine since deletion did, and
 * nothing dispatched it. The log always kept the recording event; what was
 * missing was any way for a merchant to ask for it back, so a mis-tapped ₹900
 * was gone for good from their point of view.
 *
 * What restore *is*, and what these pin: the original recording event re-emitted
 * under a fresh envelope with the **same entry id** (ADR-0017). Not a new
 * transaction that resembles the old one — the same entry, at its own amount,
 * with its own identity. The difference is the whole point: a merchant who
 * restores must get their balance back, not a second entry that happens to
 * match.
 */

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { VyoraProvider } from "@/features/vyora/VyoraProvider";
import { PartyStatement } from "@/features/vyora/screens/PartyStatement";
import { saveLog } from "@/lib/vyora/store";
import { reduceEvents } from "@/lib/vyora/events";
import type { LedgerEvent } from "@/lib/vyora/events";

const LOG_KEY = "vyora.events.v2";
const PARTY = "pty_restore";
const ENTRY = "txn_restore_900";
const PAYMENT = "pay_restore_200";

const AT = "2026-07-01T09:00:00.000Z";

const SEED: LedgerEvent[] = [
  {
    id: "evt_r1",
    at: AT,
    type: "ContactCreated",
    party: { id: PARTY, name: "RESTORE PROBE", createdAt: AT },
  } as LedgerEvent,
  {
    id: "evt_r2",
    at: "2026-07-01T09:10:00.000Z",
    type: "CreditRecorded",
    transaction: {
      id: ENTRY,
      partyId: PARTY,
      amount: 900,
      kind: "given",
      date: "2026-07-01",
      createdAt: "2026-07-01T09:10:00.000Z",
    },
  } as LedgerEvent,
  {
    id: "evt_r3",
    at: "2026-07-01T09:20:00.000Z",
    type: "PaymentRecorded",
    payment: {
      id: PAYMENT,
      partyId: PARTY,
      amount: 200,
      kind: "received",
      date: "2026-07-01",
      createdAt: "2026-07-01T09:20:00.000Z",
    },
  } as LedgerEvent,
];

const wrapper = ({ children }: { children: ReactNode }) => (
  <VyoraProvider>{children}</VyoraProvider>
);

/** What the log actually holds, read back the way the app stores it. */
function storedEvents(): LedgerEvent[] {
  const raw = window.localStorage.getItem(LOG_KEY);
  if (!raw) return [];
  const parsed = JSON.parse(raw) as { events?: LedgerEvent[] };
  return parsed.events ?? [];
}

const foldOf = (events: LedgerEvent[]) => reduceEvents(events);

beforeEach(() => {
  window.localStorage.clear();
  saveLog(SEED);
  // `confirm` is the screen's existing guard; the tests answer it rather than
  // route around it, so the affordance is exercised the way a merchant does.
  vi.stubGlobal("confirm", () => true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

async function deleteFirstEntry() {
  const user = userEvent.setup();
  render(<PartyStatement partyId={PARTY} />, { wrapper });
  await screen.findByText("RESTORE PROBE");

  const buttons = await screen.findAllByLabelText("Delete entry");
  await act(async () => {
    await user.click(buttons[0]!);
  });
  return user;
}

describe("restoring an entry the merchant just deleted", () => {
  it("offers to put it back, and says it is out of the balance until then", async () => {
    await deleteFirstEntry();

    const notice = await screen.findByTestId("restore-entry");
    expect(notice).toHaveTextContent(/out of the balance until you put it back/i);
    // The repository's own word for this, and the one `feedback.ts` already
    // reports on success.
    expect(notice).toHaveTextContent(/Restore/);
  });

  it("puts the original entry back, at its original amount and id", async () => {
    const user = await deleteFirstEntry();

    await waitFor(() => {
      expect(foldOf(storedEvents()).transactions.find((t) => t.id === ENTRY)).toBeUndefined();
    });

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Restore" }));
    });

    await waitFor(() => {
      const restored = foldOf(storedEvents()).transactions.find((t) => t.id === ENTRY);
      expect(restored).toBeDefined();
      // The same entry, not a new one that resembles it.
      expect(restored!.amount).toBe(900);
      expect(restored!.partyId).toBe(PARTY);
    });
  });

  it("leaves exactly one entry, not a second one that looks the same", async () => {
    const user = await deleteFirstEntry();
    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Restore" }));
    });

    await waitFor(() => {
      const mine = foldOf(storedEvents()).transactions.filter((t) => t.id === ENTRY);
      expect(mine).toHaveLength(1);
    });
  });

  it("keeps the deletion and the original recording in the log", async () => {
    const user = await deleteFirstEntry();
    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Restore" }));
    });

    await waitFor(() => {
      const events = storedEvents();
      // Nothing is erased or rewritten: the log says the entry was recorded,
      // removed, and recorded again — which is what happened.
      expect(events.filter((e) => e.type === "EntryDeleted")).toHaveLength(1);
      expect(events.filter((e) => e.type === "CreditRecorded")).toHaveLength(2);
      // And the original event is byte-identical to the one that was seeded.
      expect(events.find((e) => e.id === "evt_r2")).toEqual(SEED[1]);
    });
  });

  it("gives the restoring event its own id, so it is a new fact in the log", async () => {
    const user = await deleteFirstEntry();
    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Restore" }));
    });

    await waitFor(() => {
      const recordings = storedEvents().filter((e) => e.type === "CreditRecorded");
      expect(recordings).toHaveLength(2);
      // Two distinct envelopes carrying the same entry: that distinction is
      // what lets the server tell a restore from a re-delivered original.
      expect(new Set(recordings.map((e) => e.id)).size).toBe(2);
      expect(
        new Set(
          recordings.map((e) => (e as unknown as { transaction: { id: string } }).transaction.id)
        ).size
      ).toBe(1);
    });
  });

  it("puts the balance back to what it was", async () => {
    const before = foldOf(SEED);
    const beforeNet =
      before.transactions.reduce((n, t) => n + t.amount, 0) -
      before.payments.reduce((n, p) => n + p.amount, 0);

    const user = await deleteFirstEntry();
    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Restore" }));
    });

    await waitFor(() => {
      const after = foldOf(storedEvents());
      const afterNet =
        after.transactions.reduce((n, t) => n + t.amount, 0) -
        after.payments.reduce((n, p) => n + p.amount, 0);
      expect(afterNet).toBe(beforeNet);
    });
  });

  it("takes the offer away once it has been used", async () => {
    const user = await deleteFirstEntry();
    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Restore" }));
    });

    // Restoring twice would be asking the log to say the same thing again; the
    // command refuses it (`ENTRY_PRESENT`), and the affordance does not offer
    // it in the first place.
    await waitFor(() => {
      expect(screen.queryByTestId("restore-entry")).toBeNull();
    });
  });

  it("does not offer to restore anything before a deletion happens", async () => {
    render(<PartyStatement partyId={PARTY} />, { wrapper });
    await screen.findByText("RESTORE PROBE");
    expect(screen.queryByTestId("restore-entry")).toBeNull();
  });
});

describe("deleting again after a restore", () => {
  it("removes it once more, deterministically", async () => {
    const user = await deleteFirstEntry();
    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Restore" }));
    });
    await waitFor(() => {
      expect(foldOf(storedEvents()).transactions.find((t) => t.id === ENTRY)).toBeDefined();
    });

    const buttons = await screen.findAllByLabelText("Delete entry");
    await act(async () => {
      await user.click(buttons[0]!);
    });

    await waitFor(() => {
      expect(foldOf(storedEvents()).transactions.find((t) => t.id === ENTRY)).toBeUndefined();
      // Two deletions and two recordings: the log keeps every one of them.
      expect(storedEvents().filter((e) => e.type === "EntryDeleted")).toHaveLength(2);
      expect(storedEvents().filter((e) => e.type === "CreditRecorded")).toHaveLength(2);
    });
  });
});
