/**
 * The wiring: which source a screen actually reads from, and what happens when
 * the remote one fails.
 *
 * These exercise the hook rather than the pure gate, because "the flag is off"
 * and "the screen used local data" are different claims and only the second one
 * is what a merchant experiences.
 */

import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { usePartyDetail, usePartyList } from "@/features/vyora/usePartySource";
import type { PartySource } from "@/lib/vyora/party-source";
import { VyoraProvider } from "@/features/vyora/VyoraProvider";
import { saveLog } from "@/lib/vyora/store";
import type { LedgerEvent } from "@/lib/vyora/events";

const LOCAL_EVENTS: LedgerEvent[] = [
  {
    id: "evt_1",
    at: "2026-07-01T09:00:00.000Z",
    type: "ContactCreated",
    party: { id: "pty_local1", name: "Local Ramesh", createdAt: "2026-07-01T09:00:00.000Z" },
  } as LedgerEvent,
  {
    id: "evt_2",
    at: "2026-07-01T09:10:00.000Z",
    type: "CreditRecorded",
    transaction: {
      id: "txn_1",
      partyId: "pty_local1",
      amount: 1500,
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
  saveLog(LOCAL_EVENTS);
}

/** A remote source that never touches the network. */
function stubRemote(overrides: Partial<PartySource> = {}): PartySource {
  return {
    kind: "remote",
    list: async () => [
      {
        party: { id: "pty_api1", name: "API Party", createdAt: "2026-07-02T09:00:00.000Z" },
        net: -500,
      },
    ],
    get: async () => ({
      party: { id: "pty_api1", name: "API Party", createdAt: "2026-07-02T09:00:00.000Z" },
      net: -500,
    }),
    ...overrides,
  };
}

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("default configuration uses the local party path", () => {
  it("lists local parties and reports source=local", async () => {
    seedLocal();
    const { result } = renderHook(() => usePartyList(""), { wrapper });

    await waitFor(() => expect(result.current.results.length).toBeGreaterThan(0));
    expect(result.current.source).toBe("local");
    expect(result.current.results[0]!.party.name).toBe("Local Ramesh");
    expect(result.current.error).toBeNull();
  });

  it("reads party detail locally", async () => {
    seedLocal();
    const { result } = renderHook(() => usePartyDetail("pty_local1"), { wrapper });

    await waitFor(() => expect(result.current.party).toBeDefined());
    expect(result.current.source).toBe("local");
    expect(result.current.party!.name).toBe("Local Ramesh");
    expect(result.current.net).toBe(1500);
  });

  it("makes no network request at all when the flag is off", async () => {
    seedLocal();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => usePartyList(""), { wrapper });
    await waitFor(() => expect(result.current.results.length).toBeGreaterThan(0));

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("development flag plus localhost API uses the remote adapter", () => {
  it("returns remote rows and reports source=remote", async () => {
    seedLocal();
    const { result } = renderHook(() => usePartyList("", { enabled: true, remote: stubRemote() }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.source).toBe("remote"));
    expect(result.current.results[0]!.party.name).toBe("API Party");
    expect(result.current.results[0]!.net).toBe(-500);
    expect(result.current.error).toBeNull();
  });

  it("returns remote party detail", async () => {
    seedLocal();
    const { result } = renderHook(
      () => usePartyDetail("pty_local1", { enabled: true, remote: stubRemote() }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.source).toBe("remote"));
    expect(result.current.party!.name).toBe("API Party");
  });

  it("shows local rows first rather than flashing empty", async () => {
    seedLocal();
    let release: (() => void) | undefined;
    const slow = stubRemote({
      list: () =>
        new Promise((resolve) => {
          release = () => resolve([]);
        }),
    });

    const { result } = renderHook(() => usePartyList("", { enabled: true, remote: slow }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.results.length).toBeGreaterThan(0));
    expect(result.current.source).toBe("local");
    release?.();
  });
});

describe("remote API failure does not lose or mutate local data", () => {
  it("falls back to local rows and reports the error for a developer", async () => {
    seedLocal();
    const failing = stubRemote({
      list: async () => {
        throw new Error("Could not reach the development API.");
      },
    });

    const { result } = renderHook(() => usePartyList("", { enabled: true, remote: failing }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.error).not.toBeNull());
    // The merchant still sees their book.
    expect(result.current.source).toBe("local");
    expect(result.current.results[0]!.party.name).toBe("Local Ramesh");
    expect(result.current.error).toContain("Could not reach");
  });

  it("leaves the stored log untouched after a remote failure", async () => {
    seedLocal();
    const before = localStorage.getItem("vyora.events.v2");

    const failing = stubRemote({
      list: async () => {
        throw new Error("boom");
      },
      get: async () => {
        throw new Error("boom");
      },
    });

    const list = renderHook(() => usePartyList("", { enabled: true, remote: failing }), {
      wrapper,
    });
    await waitFor(() => expect(list.result.current.error).not.toBeNull());

    const detail = renderHook(
      () => usePartyDetail("pty_local1", { enabled: true, remote: failing }),
      { wrapper }
    );
    await waitFor(() => expect(detail.result.current.error).not.toBeNull());

    expect(localStorage.getItem("vyora.events.v2")).toBe(before);
    expect(detail.result.current.party!.name).toBe("Local Ramesh");
    expect(detail.result.current.net).toBe(1500);
  });

  it("recovers on retry without any local repair step", async () => {
    seedLocal();
    let shouldFail = true;
    const flaky = stubRemote({
      list: async () => {
        if (shouldFail) throw new Error("temporary");
        return [
          {
            party: { id: "pty_api1", name: "API Party", createdAt: "2026-07-02T09:00:00.000Z" },
            net: 0,
          },
        ];
      },
    });

    const { result } = renderHook(() => usePartyList("", { enabled: true, remote: flaky }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.source).toBe("local");

    shouldFail = false;
    result.current.retry();

    await waitFor(() => expect(result.current.source).toBe("remote"));
    expect(result.current.error).toBeNull();
  });

  it("does not let a remote party detail miss hide the local one", async () => {
    seedLocal();
    const empty = stubRemote({ get: async () => null });

    const { result } = renderHook(
      () => usePartyDetail("pty_local1", { enabled: true, remote: empty }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.party).toBeDefined());
    // A null remote answer is not evidence the party is gone.
    expect(result.current.party!.name).toBe("Local Ramesh");
    expect(result.current.source).toBe("local");
  });
});
