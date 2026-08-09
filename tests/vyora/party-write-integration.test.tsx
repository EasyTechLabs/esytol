/**
 * Which destination a write actually reaches.
 *
 * "The flag is off" and "the write went to the device" are different claims,
 * and only the second is what a merchant experiences. These exercise the hook
 * against a real provider and a real localStorage.
 *
 * The central guarantee under test: **exactly one destination per action.** A
 * remote write must never also write locally, and a failed remote write must
 * never fall back to a local one. One press of Add produces one record, or
 * none — never two that disagree.
 */

import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { usePartyWriter } from "@/features/vyora/usePartyWriter";
import type { PartyWriter } from "@/lib/vyora/party-source";
import { VyoraProvider } from "@/features/vyora/VyoraProvider";
import { saveLog } from "@/lib/vyora/store";
import type { LedgerEvent } from "@/lib/vyora/events";

const LOG_KEY = "vyora.events.v2";

const SEED: LedgerEvent[] = [
  {
    id: "evt_seed1",
    at: "2026-07-01T09:00:00.000Z",
    type: "ContactCreated",
    party: { id: "pty_seedlocal", name: "SEED LOCAL", createdAt: "2026-07-01T09:00:00.000Z" },
  } as LedgerEvent,
];

function wrapper({ children }: { children: ReactNode }) {
  return <VyoraProvider>{children}</VyoraProvider>;
}

function seedLocal() {
  localStorage.clear();
  saveLog(SEED);
}

function apiParty(name: string, version = 1) {
  return {
    party: { id: "pty_api-remote1", name, createdAt: "2026-08-09T09:00:00.000Z" },
    etag: `"${version}"`,
    version,
  };
}

function stubWriter(overrides: Partial<PartyWriter> = {}): PartyWriter {
  return {
    kind: "remote",
    create: async () => apiParty("Remote Created"),
    update: async () => apiParty("Remote Updated", 2),
    ...overrides,
  };
}

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("default mode continues using local Party writes", () => {
  it("targets local and writes to the device log", async () => {
    seedLocal();
    const { result } = renderHook(() => usePartyWriter(), { wrapper });
    await waitFor(() => expect(result.current.target).toBe("local"));

    const before = localStorage.getItem(LOG_KEY)!;
    let ok = false;
    await act(async () => {
      ok = await result.current.createParty({ name: "Local Made" });
    });

    expect(ok).toBe(true);
    const after = localStorage.getItem(LOG_KEY)!;
    expect(after).not.toBe(before);
    expect(after).toContain("Local Made");
  });

  it("makes no network request on the default path", async () => {
    seedLocal();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => usePartyWriter(), { wrapper });
    await waitFor(() => expect(result.current.target).toBe("local"));
    await act(async () => {
      await result.current.createParty({ name: "Local Only" });
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("remote create changes only API data, not local storage", () => {
  it("writes nothing to the device", async () => {
    seedLocal();
    const before = localStorage.getItem(LOG_KEY)!;
    const remote = stubWriter();

    const { result } = renderHook(() => usePartyWriter({ enabled: true, remote }), { wrapper });
    await waitFor(() => expect(result.current.target).toBe("remote"));

    let ok = false;
    await act(async () => {
      ok = await result.current.createParty({ name: "Remote Created" });
    });

    expect(ok).toBe(true);
    // The single most important assertion in this file.
    expect(localStorage.getItem(LOG_KEY)).toBe(before);
    expect(localStorage.getItem(LOG_KEY)).not.toContain("Remote Created");
  });

  it("passes the caller's input through and keeps the returned ETag", async () => {
    seedLocal();
    const create = vi.fn(async () => apiParty("Remote Created"));
    const { result } = renderHook(
      () => usePartyWriter({ enabled: true, remote: stubWriter({ create }) }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.target).toBe("remote"));

    await act(async () => {
      await result.current.createParty({ name: "Ramesh", phone: "9000000001" });
    });

    expect(create).toHaveBeenCalledTimes(1);
    const [id, input] = create.mock.calls[0] as unknown as [
      string,
      { name: string; phone?: string },
    ];
    expect(id).toMatch(/^pty_/);
    expect(input).toMatchObject({ name: "Ramesh", phone: "9000000001" });
    await waitFor(() => expect(result.current.lastEtag).toBe('"1"'));
  });
});

describe("remote update sends If-Match", () => {
  it("forwards the ETag the caller supplies", async () => {
    seedLocal();
    const update = vi.fn(async () => apiParty("Remote Updated", 2));
    const { result } = renderHook(
      () => usePartyWriter({ enabled: true, remote: stubWriter({ update }) }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.target).toBe("remote"));

    await act(async () => {
      await result.current.updateParty("pty_api-remote1", '"1"', { name: "Renamed" });
    });

    expect(update).toHaveBeenCalledWith("pty_api-remote1", '"1"', { name: "Renamed" });
    await waitFor(() => expect(result.current.lastEtag).toBe('"2"'));
  });

  it("does not touch local storage on a successful remote update", async () => {
    seedLocal();
    const before = localStorage.getItem(LOG_KEY)!;
    const { result } = renderHook(() => usePartyWriter({ enabled: true, remote: stubWriter() }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.target).toBe("remote"));

    await act(async () => {
      await result.current.updateParty("pty_api-remote1", '"1"', { name: "Renamed" });
    });

    expect(localStorage.getItem(LOG_KEY)).toBe(before);
  });
});

describe("a stale update is rejected without overwrite", () => {
  it("reports a conflict distinctly from an outage", async () => {
    seedLocal();
    const conflictError = Object.assign(new Error('VERSION_CONFLICT: If-Match "1" is stale.'), {
      status: 412,
    });
    const remote = stubWriter({
      update: async () => {
        throw conflictError;
      },
    });

    const { result } = renderHook(() => usePartyWriter({ enabled: true, remote }), { wrapper });
    await waitFor(() => expect(result.current.target).toBe("remote"));

    let ok = true;
    await act(async () => {
      ok = await result.current.updateParty("pty_api-remote1", '"1"', { name: "Stale" });
    });

    expect(ok).toBe(false);
    await waitFor(() => expect(result.current.conflict).toBe(true));
    expect(result.current.error).toContain("VERSION_CONFLICT");
  });

  it("treats a missing precondition (428) as a conflict too", async () => {
    seedLocal();
    const remote = stubWriter({
      update: async () => {
        throw Object.assign(new Error("PRECONDITION_REQUIRED"), { status: 428 });
      },
    });
    const { result } = renderHook(() => usePartyWriter({ enabled: true, remote }), { wrapper });
    await waitFor(() => expect(result.current.target).toBe("remote"));

    await act(async () => {
      await result.current.updateParty("pty_api-remote1", "", { name: "x" });
    });
    await waitFor(() => expect(result.current.conflict).toBe(true));
  });

  it("writes nothing locally when a stale update is rejected", async () => {
    seedLocal();
    const before = localStorage.getItem(LOG_KEY)!;
    const remote = stubWriter({
      update: async () => {
        throw Object.assign(new Error("VERSION_CONFLICT"), { status: 412 });
      },
    });
    const { result } = renderHook(() => usePartyWriter({ enabled: true, remote }), { wrapper });
    await waitFor(() => expect(result.current.target).toBe("remote"));

    await act(async () => {
      await result.current.updateParty("pty_api-remote1", '"1"', { name: "Stale" });
    });

    expect(localStorage.getItem(LOG_KEY)).toBe(before);
  });
});

describe("a failed remote write creates no local write and no partial write", () => {
  it("does not fall back to a local write when the API is unreachable", async () => {
    seedLocal();
    const before = localStorage.getItem(LOG_KEY)!;
    const remote = stubWriter({
      create: async () => {
        throw new Error("Could not reach the development API.");
      },
    });

    const { result } = renderHook(() => usePartyWriter({ enabled: true, remote }), { wrapper });
    await waitFor(() => expect(result.current.target).toBe("remote"));

    let ok = true;
    await act(async () => {
      ok = await result.current.createParty({ name: "Should Not Exist Anywhere" });
    });

    expect(ok).toBe(false);
    // No local fallback. The write went nowhere, which is the correct outcome.
    expect(localStorage.getItem(LOG_KEY)).toBe(before);
    expect(localStorage.getItem(LOG_KEY)).not.toContain("Should Not Exist Anywhere");
    await waitFor(() => expect(result.current.error).toContain("Could not reach"));
    expect(result.current.conflict).toBe(false);
  });

  it("reports a validation failure and writes nothing", async () => {
    seedLocal();
    const before = localStorage.getItem(LOG_KEY)!;
    const remote = stubWriter({
      create: async () => {
        throw Object.assign(new Error("VALIDATION_FAILED: name must be 1-100 characters"), {
          status: 422,
        });
      },
    });

    const { result } = renderHook(() => usePartyWriter({ enabled: true, remote }), { wrapper });
    await waitFor(() => expect(result.current.target).toBe("remote"));

    let ok = true;
    await act(async () => {
      ok = await result.current.createParty({ name: "" });
    });

    expect(ok).toBe(false);
    expect(localStorage.getItem(LOG_KEY)).toBe(before);
    await waitFor(() => expect(result.current.error).toContain("VALIDATION_FAILED"));
    // A validation failure is not a conflict; the UI must not offer "re-read".
    expect(result.current.conflict).toBe(false);
  });

  it("recovers on a later attempt without any local repair step", async () => {
    seedLocal();
    const before = localStorage.getItem(LOG_KEY)!;
    let fail = true;
    const remote = stubWriter({
      create: async () => {
        if (fail) throw new Error("temporary");
        return apiParty("Remote Created");
      },
    });

    const { result } = renderHook(() => usePartyWriter({ enabled: true, remote }), { wrapper });
    await waitFor(() => expect(result.current.target).toBe("remote"));

    await act(async () => {
      await result.current.createParty({ name: "Attempt 1" });
    });
    await waitFor(() => expect(result.current.error).not.toBeNull());

    fail = false;
    let ok = false;
    await act(async () => {
      ok = await result.current.createParty({ name: "Attempt 2" });
    });

    expect(ok).toBe(true);
    await waitFor(() => expect(result.current.error).toBeNull());
    // Still nothing on the device, across the failure and the recovery.
    expect(localStorage.getItem(LOG_KEY)).toBe(before);
  });
});

describe("no dual writes", () => {
  it("a remote create calls the remote writer exactly once and the device zero times", async () => {
    seedLocal();
    const before = localStorage.getItem(LOG_KEY)!;
    const create = vi.fn(async () => apiParty("Once"));
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    const { result } = renderHook(
      () => usePartyWriter({ enabled: true, remote: stubWriter({ create }) }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.target).toBe("remote"));
    setItem.mockClear();

    await act(async () => {
      await result.current.createParty({ name: "Once" });
    });

    expect(create).toHaveBeenCalledTimes(1);
    // Nothing on this path may persist to the device.
    const logWrites = setItem.mock.calls.filter(([k]) => k === LOG_KEY);
    expect(logWrites).toHaveLength(0);
    expect(localStorage.getItem(LOG_KEY)).toBe(before);
    setItem.mockRestore();
  });
});
