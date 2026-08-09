/**
 * Payments and the ledger summary, at the hook and adapter level.
 *
 * Same invariant as credits, restated because a payment is also money: the
 * remote path writes to the API and only the API, and a failed write leaves the
 * device log byte-identical.
 *
 * The summary has an invariant of its own — it does not fall back. A statement
 * that falls back shows a stale history, which is still a history. A summary
 * that fell back would show device totals under a server heading, and nothing
 * on screen would say which set of numbers the merchant was reading.
 */

import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { usePaymentWriter, usePartySummary } from "@/features/vyora/useLedgerSource";
import { remoteLedgerSource } from "@/lib/vyora/ledger-source";
import type { LedgerSource, RemoteStatementRow, RemoteSummary } from "@/lib/vyora/ledger-source";
import { VyoraProvider } from "@/features/vyora/VyoraProvider";
import { saveLog } from "@/lib/vyora/store";
import type { LedgerEvent } from "@/lib/vyora/events";

const LOG_KEY = "vyora.events.v2";
const PARTY = "pty_paylocal";

const SEED: LedgerEvent[] = [
  {
    id: "evt_p1",
    at: "2026-07-01T09:00:00.000Z",
    type: "ContactCreated",
    party: { id: PARTY, name: "PAYMENT LOCAL", createdAt: "2026-07-01T09:00:00.000Z" },
  } as LedgerEvent,
  {
    id: "evt_p2",
    at: "2026-07-01T09:10:00.000Z",
    type: "CreditRecorded",
    transaction: {
      id: "txn_paylocal1",
      partyId: PARTY,
      amount: 900,
      kind: "given",
      date: "2026-07-01",
      createdAt: "2026-07-01T09:10:00.000Z",
    },
  } as LedgerEvent,
];

function wrapper({ children }: { children: ReactNode }) {
  return <VyoraProvider>{children}</VyoraProvider>;
}
function seedLocal() {
  localStorage.clear();
  saveLog(SEED);
}

function paymentRow(overrides: Partial<RemoteStatementRow> = {}): RemoteStatementRow {
  return {
    id: "pay_remote1",
    partyId: PARTY,
    entryType: "payment",
    direction: "received",
    amount: 400,
    description: null,
    date: "2026-08-09",
    dueDate: null,
    createdAt: "2026-08-09T10:00:00.000Z",
    eventId: "evt_remotepay1",
    signedAmount: -400,
    runningNet: 500,
    label: "Payment received",
    ...overrides,
  };
}

function remoteSummary(overrides: Partial<RemoteSummary> = {}): RemoteSummary {
  return {
    partyId: PARTY,
    balance: { net: 500, position: "owes_merchant", entryCount: 2, lastActivityAt: null },
    totals: { creditGiven: 900, creditTaken: 0, paymentReceived: 400, paymentPaid: 0 },
    counts: { credits: 1, payments: 1 },
    firstActivityAt: "2026-07-01T09:10:00.000Z",
    ...overrides,
  };
}

function stubLedger(overrides: Partial<LedgerSource> = {}): LedgerSource {
  return {
    kind: "remote",
    statement: async () => ({
      partyId: PARTY,
      rows: [paymentRow()],
      balance: { net: 500, position: "owes_merchant", entryCount: 1, lastActivityAt: null },
    }),
    summary: async () => remoteSummary(),
    recordCredit: async () => paymentRow({ entryType: "credit", direction: "given" }),
    recordPayment: async () => paymentRow(),
    ...overrides,
  };
}

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("recording a payment writes to the API and nowhere else", () => {
  it("calls the remote writer once and localStorage zero times", async () => {
    seedLocal();
    const before = localStorage.getItem(LOG_KEY);
    const recordPayment = vi.fn(async () => paymentRow());
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    const { result } = renderHook(
      () => usePaymentWriter({ remote: stubLedger({ recordPayment }), writesEnabled: true }),
      { wrapper }
    );

    let ok = false;
    await act(async () => {
      ok = await result.current.recordPayment(PARTY, {
        amount: 400,
        kind: "received",
        date: "2026-08-09",
      });
    });

    expect(ok).toBe(true);
    expect(recordPayment).toHaveBeenCalledTimes(1);
    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage.getItem(LOG_KEY)).toBe(before);
    setItem.mockRestore();
  });

  it("leaves the device log byte-identical when the API refuses", async () => {
    seedLocal();
    const before = localStorage.getItem(LOG_KEY);
    const recordPayment = vi.fn(async () => {
      throw new Error("DEPENDENCY_UNAVAILABLE: could not reach the local API");
    });

    const { result } = renderHook(
      () => usePaymentWriter({ remote: stubLedger({ recordPayment }), writesEnabled: true }),
      { wrapper }
    );

    let ok = true;
    await act(async () => {
      ok = await result.current.recordPayment(PARTY, {
        amount: 400,
        kind: "received",
        date: "2026-08-09",
      });
    });

    // No fallback. The payment reached nothing, and inventing a local copy
    // would leave two records of one action with no way to tell which is real.
    expect(ok).toBe(false);
    expect(result.current.error).toContain("DEPENDENCY_UNAVAILABLE");
    expect(localStorage.getItem(LOG_KEY)).toBe(before);
  });

  it("does nothing at all when remote writes are disabled", async () => {
    seedLocal();
    const recordPayment = vi.fn(async () => paymentRow());

    const { result } = renderHook(
      () => usePaymentWriter({ remote: stubLedger({ recordPayment }), writesEnabled: false }),
      { wrapper }
    );

    expect(result.current.target).toBe("local");
    let ok = true;
    await act(async () => {
      ok = await result.current.recordPayment(PARTY, {
        amount: 400,
        kind: "received",
        date: "2026-08-09",
      });
    });
    expect(ok).toBe(false);
    expect(recordPayment).not.toHaveBeenCalled();
  });
});

describe("the payment adapter posts what the contract expects", () => {
  it("mints a pay_ id, sends an idempotency key, and never sends a merchantId", async () => {
    const fetchMock = vi.fn(
      async (_u: string, _i?: RequestInit) =>
        new Response(JSON.stringify(paymentRow()), {
          status: 201,
          headers: { "content-type": "application/json" },
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    await remoteLedgerSource("/api/vyora-dev/parties").recordPayment(PARTY, {
      amount: 400,
      kind: "received",
      note: "part payment",
      date: "2026-08-09",
    });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(`/api/vyora-dev/parties/${PARTY}/payments`);
    expect(String(url)).not.toContain("4000");
    expect(init?.method).toBe("POST");

    const headers = init?.headers as Record<string, string>;
    expect(headers["idempotency-key"]).toMatch(/^[0-9a-f-]{36}$/i);
    expect(Object.keys(headers).map((h) => h.toLowerCase())).not.toContain("x-vyora-dev-identity");

    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    // `pay_` matches the local Payment id, so a mistaken reuse of a credit id
    // is legible in a log rather than merely rejected.
    expect(String(body.id)).toMatch(/^pay_/);
    expect(body.kind).toBe("received");
    expect(body.note).toBe("part payment");
    // Tenant scope comes from the token the server attaches. There is no field
    // here through which a caller could name a workspace.
    expect(body).not.toHaveProperty("merchantId");
    expect(body).not.toHaveProperty("partyId");
    // And nothing that claims to settle a nominated entry.
    expect(body).not.toHaveProperty("appliesTo");
  });

  it("reads the summary with no limit", async () => {
    const fetchMock = vi.fn(
      async (_u: string, _i?: RequestInit) =>
        new Response(JSON.stringify(remoteSummary()), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    await remoteLedgerSource("/api/vyora-dev/parties").summary(PARTY);

    const [url] = fetchMock.mock.calls[0]!;
    // A total over the first page is not a total.
    expect(String(url)).toBe(`/api/vyora-dev/parties/${PARTY}/summary`);
    expect(String(url)).not.toContain("limit");
  });
});

describe("the summary reports the API's totals, or none at all", () => {
  it("exposes gross totals beside the one signed net", async () => {
    seedLocal();
    const { result } = renderHook(
      () => usePartySummary(PARTY, { remote: stubLedger(), readsEnabled: true }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.summary).not.toBeNull());
    expect(result.current.summary!.totals).toEqual({
      creditGiven: 900,
      creditTaken: 0,
      paymentReceived: 400,
      paymentPaid: 0,
    });
    expect(result.current.summary!.balance.net).toBe(500);
    expect(result.current.error).toBeNull();
  });

  it("returns null rather than substituting local totals when the API fails", async () => {
    seedLocal();
    const summary = vi.fn(async () => {
      throw new Error("DEPENDENCY_UNAVAILABLE: could not reach the local API");
    });

    const { result } = renderHook(
      () => usePartySummary(PARTY, { remote: stubLedger({ summary }), readsEnabled: true }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.error).not.toBeNull());
    // The local ledger holds 900 for this party. Showing that under a heading
    // that says "from the API" is the failure this asserts against.
    expect(result.current.summary).toBeNull();
    expect(result.current.error).toContain("DEPENDENCY_UNAVAILABLE");
  });

  it("requests nothing at all when reads are disabled", async () => {
    seedLocal();
    const summary = vi.fn(async () => remoteSummary());

    const { result } = renderHook(
      () => usePartySummary(PARTY, { remote: stubLedger({ summary }), readsEnabled: false }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(summary).not.toHaveBeenCalled();
    expect(result.current.summary).toBeNull();
    expect(result.current.error).toBeNull();
  });
});

describe("the development credential never reaches the browser", () => {
  it("is absent from every ledger source file", () => {
    // The adapter must talk to this app's own route, never the API directly,
    // and must never name the identity header.
    for (const file of [
      "lib/vyora/ledger-source.ts",
      "features/vyora/useLedgerSource.ts",
      "features/vyora/DevRecordPayment.tsx",
      "features/vyora/DevLedgerSummary.tsx",
    ]) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      expect(source).not.toContain("VYORA_API_DEV_IDENTITY");
      expect(source).not.toContain("x-vyora-dev-identity");
      expect(source).not.toContain("127.0.0.1:4000");
    }
  });
});
