/**
 * The ledger slice, at the hook and adapter level.
 *
 * Same invariant as the party write slice, restated for entries because the
 * stakes are higher: an entry is money. A remote credit goes to the API and
 * only the API, and a failed one writes nothing anywhere.
 */

import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { useCreditWriter, useStatement } from "@/features/vyora/useLedgerSource";
import { remoteLedgerSource, toLocalStatementRow } from "@/lib/vyora/ledger-source";
import type { LedgerSource, RemoteStatementRow } from "@/lib/vyora/ledger-source";
import { VyoraProvider } from "@/features/vyora/VyoraProvider";
import { saveLog } from "@/lib/vyora/store";
import type { LedgerEvent } from "@/lib/vyora/events";

const LOG_KEY = "vyora.events.v2";
const PARTY = "pty_ledgerlocal";

const SEED: LedgerEvent[] = [
  {
    id: "evt_l1",
    at: "2026-07-01T09:00:00.000Z",
    type: "ContactCreated",
    party: { id: PARTY, name: "LEDGER LOCAL", createdAt: "2026-07-01T09:00:00.000Z" },
  } as LedgerEvent,
  {
    id: "evt_l2",
    at: "2026-07-01T09:10:00.000Z",
    type: "CreditRecorded",
    transaction: {
      id: "txn_local1",
      partyId: PARTY,
      amount: 700,
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

function remoteRow(overrides: Partial<RemoteStatementRow> = {}): RemoteStatementRow {
  return {
    id: "txn_remote1",
    partyId: PARTY,
    entryType: "credit",
    direction: "given",
    amount: 2500,
    description: "remote entry",
    date: "2026-08-09",
    dueDate: null,
    createdAt: "2026-08-09T10:00:00.000Z",
    eventId: "evt_remote1",
    signedAmount: 2500,
    runningNet: 2500,
    label: "Credit given",
    ...overrides,
  };
}

function stubLedger(overrides: Partial<LedgerSource> = {}): LedgerSource {
  return {
    kind: "remote",
    statement: async () => ({
      partyId: PARTY,
      rows: [remoteRow()],
      balance: { net: 2500, position: "owes_merchant", entryCount: 1, lastActivityAt: null },
    }),
    recordCredit: async () => remoteRow(),
    ...overrides,
  };
}

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("default mode uses the local statement", () => {
  it("reads local rows and reports source=local", async () => {
    seedLocal();
    const { result } = renderHook(() => useStatement(PARTY, "LEDGER LOCAL"), { wrapper });
    await waitFor(() => expect(result.current.rows.length).toBeGreaterThan(0));
    expect(result.current.source).toBe("local");
    expect(result.current.net).toBe(700);
    expect(result.current.error).toBeNull();
  });

  it("makes no network request when ledger reads are off", async () => {
    seedLocal();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useStatement(PARTY, "LEDGER LOCAL"), { wrapper });
    await waitFor(() => expect(result.current.rows.length).toBeGreaterThan(0));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a remote credit when ledger writes are off, without writing locally", async () => {
    seedLocal();
    const before = localStorage.getItem(LOG_KEY)!;
    const { result } = renderHook(() => useCreditWriter(), { wrapper });
    await waitFor(() => expect(result.current.target).toBe("local"));

    let ok = true;
    await act(async () => {
      ok = await result.current.recordCredit(PARTY, {
        amount: 100,
        kind: "given",
        date: "2026-08-09",
      });
    });

    expect(ok).toBe(false);
    // This hook adds no local write; the existing local flow is untouched.
    expect(localStorage.getItem(LOG_KEY)).toBe(before);
  });
});

describe("remote statement replaces the display only", () => {
  it("shows API rows and the API balance", async () => {
    seedLocal();
    const { result } = renderHook(
      () => useStatement(PARTY, "LEDGER LOCAL", { readsEnabled: true, remote: stubLedger() }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.source).toBe("remote"));
    expect(result.current.rows[0]!.label).toBe("Credit given");
    expect(result.current.rows[0]!.amount).toBe(2500);
    expect(result.current.net).toBe(2500);
  });

  it("leaves the local log byte-identical", async () => {
    seedLocal();
    const before = localStorage.getItem(LOG_KEY)!;
    const { result } = renderHook(
      () => useStatement(PARTY, "LEDGER LOCAL", { readsEnabled: true, remote: stubLedger() }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.source).toBe("remote"));
    expect(localStorage.getItem(LOG_KEY)).toBe(before);
  });

  it("falls back to the local statement when the API fails", async () => {
    seedLocal();
    const failing = stubLedger({
      statement: async () => {
        throw new Error("DEPENDENCY_UNAVAILABLE: Could not reach the development API.");
      },
    });
    const { result } = renderHook(
      () => useStatement(PARTY, "LEDGER LOCAL", { readsEnabled: true, remote: failing }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.error).not.toBeNull());
    // A stale statement is harmless; an empty one looks like lost money.
    expect(result.current.source).toBe("local");
    expect(result.current.net).toBe(700);
    expect(result.current.rows.length).toBeGreaterThan(0);
  });

  it("takes runningNet from the API rather than recomputing it", () => {
    const row = remoteRow({ amount: 100, signedAmount: 100, runningNet: 9999 });
    expect(toLocalStatementRow(row, "N").runningNet).toBe(9999);
  });
});

describe("remote credit writes only to the API", () => {
  it("records and leaves local storage untouched", async () => {
    seedLocal();
    const before = localStorage.getItem(LOG_KEY)!;
    const recordCredit = vi.fn(async () => remoteRow());
    const { result } = renderHook(
      () => useCreditWriter({ writesEnabled: true, remote: stubLedger({ recordCredit }) }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.target).toBe("remote"));

    let ok = false;
    await act(async () => {
      ok = await result.current.recordCredit(PARTY, {
        amount: 2500,
        kind: "given",
        date: "2026-08-09",
      });
    });

    expect(ok).toBe(true);
    expect(recordCredit).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(LOG_KEY)).toBe(before);
  });

  it("writes nothing anywhere when the API is unreachable", async () => {
    seedLocal();
    const before = localStorage.getItem(LOG_KEY)!;
    const failing = stubLedger({
      recordCredit: async () => {
        throw new Error("Could not reach the development API.");
      },
    });
    const { result } = renderHook(() => useCreditWriter({ writesEnabled: true, remote: failing }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.target).toBe("remote"));

    let ok = true;
    await act(async () => {
      ok = await result.current.recordCredit(PARTY, {
        amount: 4242,
        kind: "given",
        date: "2026-08-09",
      });
    });

    expect(ok).toBe(false);
    // No dual write, no fallback: the entry reached nothing.
    expect(localStorage.getItem(LOG_KEY)).toBe(before);
    expect(localStorage.getItem(LOG_KEY)).not.toContain("4242");
    await waitFor(() => expect(result.current.error).toContain("Could not reach"));
  });

  it("never calls setItem on the device during a remote credit", async () => {
    seedLocal();
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const { result } = renderHook(
      () => useCreditWriter({ writesEnabled: true, remote: stubLedger() }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.target).toBe("remote"));
    setItem.mockClear();

    await act(async () => {
      await result.current.recordCredit(PARTY, {
        amount: 2500,
        kind: "given",
        date: "2026-08-09",
      });
    });

    expect(setItem.mock.calls.filter(([k]) => k === LOG_KEY)).toHaveLength(0);
    setItem.mockRestore();
  });

  it("recovers on a later attempt with no local repair", async () => {
    seedLocal();
    const before = localStorage.getItem(LOG_KEY)!;
    let fail = true;
    const flaky = stubLedger({
      recordCredit: async () => {
        if (fail) throw new Error("temporary");
        return remoteRow();
      },
    });
    const { result } = renderHook(() => useCreditWriter({ writesEnabled: true, remote: flaky }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.target).toBe("remote"));

    await act(async () => {
      await result.current.recordCredit(PARTY, { amount: 1, kind: "given", date: "2026-08-09" });
    });
    await waitFor(() => expect(result.current.error).not.toBeNull());

    fail = false;
    let ok = false;
    await act(async () => {
      ok = await result.current.recordCredit(PARTY, {
        amount: 1,
        kind: "given",
        date: "2026-08-09",
      });
    });

    expect(ok).toBe(true);
    await waitFor(() => expect(result.current.error).toBeNull());
    expect(localStorage.getItem(LOG_KEY)).toBe(before);
  });
});

describe("the remote adapter talks only to the proxy", () => {
  it("posts a credit through the proxy with an Idempotency-Key", async () => {
    const fetchMock = vi.fn(
      async (_u: string, _i?: RequestInit) =>
        new Response(JSON.stringify(remoteRow()), {
          status: 201,
          headers: { "content-type": "application/json" },
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    await remoteLedgerSource().recordCredit(PARTY, {
      amount: 2500,
      kind: "given",
      date: "2026-08-09",
    });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(`/api/vyora-dev/parties/${PARTY}/credits`);
    expect(String(url)).not.toContain("4000");
    const headers = init?.headers as Record<string, string>;
    expect(headers["idempotency-key"]).toMatch(/^[0-9a-f-]{36}$/i);
    expect(Object.keys(headers).map((h) => h.toLowerCase())).not.toContain("x-vyora-dev-identity");
    // The entry id is client-minted, so it exists offline from the first moment.
    expect(JSON.parse(String(init?.body)).id).toMatch(/^txn_/);
  });

  it("reads a statement through the proxy", async () => {
    const fetchMock = vi.fn(
      async (_u: string) =>
        new Response(JSON.stringify({ partyId: PARTY, rows: [], balance: { net: 0 } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
    );
    vi.stubGlobal("fetch", fetchMock);
    await remoteLedgerSource().statement(PARTY);
    expect(String(fetchMock.mock.calls[0]![0])).toContain(
      `/api/vyora-dev/parties/${PARTY}/statement`
    );
  });

  it("surfaces the API's error code rather than a bare status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: { code: "NOT_FOUND", message: "No party in this workspace." },
            }),
            { status: 404, headers: { "content-type": "application/json" } }
          )
      )
    );
    await expect(remoteLedgerSource().statement(PARTY)).rejects.toThrow(/NOT_FOUND/);
  });
});

describe("credential containment for the ledger slice", () => {
  it("no client-side ledger module mentions the identity or its header", () => {
    for (const file of [
      join(process.cwd(), "lib", "vyora", "ledger-source.ts"),
      join(process.cwd(), "features", "vyora", "useLedgerSource.ts"),
    ]) {
      const src = readFileSync(file, "utf8");
      expect(src).not.toContain("VYORA_API_DEV_IDENTITY");
      expect(src).not.toContain("x-vyora-dev-identity");
    }
  });

  it("the ledger proxy routes expose only their intended verb", () => {
    const base = join(process.cwd(), "app", "api", "vyora-dev", "parties", "[partyId]");
    const statement = readFileSync(join(base, "statement", "route.ts"), "utf8");
    const credits = readFileSync(join(base, "credits", "route.ts"), "utf8");

    expect(statement).toContain("export async function GET");
    expect(credits).toContain("export async function POST");

    // An entry is appended once and never edited or removed.
    for (const src of [statement, credits]) {
      expect(src).not.toContain("export async function DELETE");
      expect(src).not.toContain("export async function PUT");
      expect(src).not.toContain("export async function PATCH");
    }
    expect(statement).not.toContain("export async function POST");
  });
});
