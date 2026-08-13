"use client";

/**
 * Vyora — the phones signed in to this account.
 *
 * One question, asked by somebody who has lost a phone: *which phones can still
 * open my shop, and how do I stop one?* Nothing on this page serves anything
 * else. There are no ids to read out, no addresses, no build numbers — a
 * merchant cannot act on any of it, and a page that reads like a diagnostic
 * panel invites somebody to recite values to whoever asked them to.
 *
 * ## The browser is never one of these devices
 *
 * A device is a phone that registered an installation key, which lives in that
 * phone's key store and nowhere else. This browser has none, so it never
 * appears in its own list and can never be the "current" device. That is why
 * the page has no self-revoke path: the confirmation the API requires for
 * revoking the calling device is unreachable from here by construction.
 *
 * ## The credential stays on the server
 *
 * Every call goes through `/api/vyora-shops/devices`, which attaches the
 * session cookie's token on the server. No token, and no installation key,
 * exists in this file or anywhere else the browser can read.
 */

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { shopClient, type Device } from "@/lib/vyora/shop-client";

const MAX_LABEL = 60;

const UNREACHABLE =
  "Vyora needs a connection to show your phones. Your book still works — this list does not.";

/**
 * The load-bearing sentence. A merchant who believes this wipes the phone will
 * not use it on the phone they have lost, which is the only one they need it
 * for.
 */
const REVOKE_EXPLANATION =
  "This stops that phone syncing with your shop. It does not erase the book already on it, and it does not remove anything that phone has already sent.";

function explainRefusal(message: string): string {
  const said = message.trim();
  if (!said) return "Vyora could not do that just now.";
  if (/\b(400|401|403|404|forbidden|unauthori[sz]ed)\b/i.test(said)) {
    return "Vyora could not do that just now.";
  }
  return said;
}

const DAY = 24 * 60 * 60 * 1000;

/** In days. A merchant recognises a phone by roughly when they last used it. */
function describeLastUsed(lastSeenAt: string | null): string {
  if (!lastSeenAt) return "Not used yet";
  const at = Date.parse(lastSeenAt);
  if (!Number.isFinite(at)) return "Last used: not known";

  const ago = Date.now() - at;
  if (ago < DAY) return "Last used today";
  if (ago < 2 * DAY) return "Last used yesterday";
  if (ago < 30 * DAY) return `Last used ${Math.round(ago / DAY)} days ago`;
  if (ago < 365 * DAY) return `Last used ${Math.round(ago / (30 * DAY))} months ago`;
  return "Last used over a year ago";
}

const nameOf = (device: Device) => device.label?.trim() || "A phone with no name yet";

export function Devices() {
  const [devices, setDevices] = useState<readonly Device[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [typed, setTyped] = useState("");

  const load = useCallback(async () => {
    const result = await shopClient.listDevices();
    if (result.kind !== "ok") {
      setProblem(result.kind === "unreachable" ? UNREACHABLE : explainRefusal(result.message));
      setDevices([]);
      return;
    }
    setProblem(null);
    setDevices(result.value.items);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rename = useCallback(
    async (device: Device) => {
      if (busy) return;
      if (typed.trim().length > MAX_LABEL) {
        setProblem(`A name can be up to ${MAX_LABEL} characters.`);
        return;
      }

      setBusy(device.deviceId);
      setProblem(null);

      const result = await shopClient.renameDevice(device.deviceId, typed.trim() || null);
      setBusy(null);

      if (result.kind !== "ok") {
        setProblem(result.kind === "unreachable" ? UNREACHABLE : explainRefusal(result.message));
        return;
      }
      setRenaming(null);
      setTyped("");
      await load();
    },
    [busy, typed, load]
  );

  const revoke = useCallback(
    async (device: Device) => {
      if (busy) return;
      setBusy(device.deviceId);
      setProblem(null);

      const result = await shopClient.revokeDevice(device.deviceId);
      setBusy(null);
      setConfirming(null);

      if (result.kind !== "ok") {
        setProblem(result.kind === "unreachable" ? UNREACHABLE : explainRefusal(result.message));
        return;
      }
      setNote("Signed out. That phone can no longer sync with your shop.");
      await load();
    },
    [busy, load]
  );

  if (devices === null) {
    return <p className="p-4 text-sm text-gray-500">Loading…</p>;
  }

  // Active first, then signed out; by name within each group.
  const ordered = [...devices].sort((a, b) => {
    if (a.status !== b.status) return a.status === "active" ? -1 : 1;
    return nameOf(a).localeCompare(nameOf(b));
  });

  return (
    <div className="flex flex-col gap-4">
      {problem ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          data-testid="devices-problem"
        >
          {problem}
        </p>
      ) : null}

      {note ? (
        <p
          className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800"
          data-testid="devices-note"
        >
          {note}
        </p>
      ) : null}

      <section className="rounded-2xl border border-gray-200 bg-white p-4">
        <h2 className="text-base font-semibold text-gray-900">Phones signed in to your account</h2>
        <p className="mt-1 text-sm text-gray-600">
          Sign a phone out if you have lost it, sold it, or given it to somebody else. The book
          already on that phone stays on it.
        </p>
      </section>

      {ordered.length === 0 ? (
        <p
          className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-600"
          data-testid="devices-empty"
        >
          No phones yet. A phone appears here once you sign in to Vyora on it.
        </p>
      ) : null}

      <ul className="flex flex-col gap-3" data-testid="device-list">
        {ordered.map((device) => {
          const revoked = device.status === "revoked";
          const working = busy === device.deviceId;

          return (
            <li
              key={device.deviceId}
              className={cn(
                "flex flex-col gap-1 rounded-2xl border border-gray-200 bg-white p-4",
                revoked && "opacity-70"
              )}
              data-testid={`device-${device.deviceId}`}
            >
              <p className="text-base font-semibold text-gray-900">{nameOf(device)}</p>
              <p className="text-sm text-gray-500">
                {revoked ? "Signed out" : describeLastUsed(device.lastSeenAt)}
              </p>

              {revoked ? (
                <p className="text-sm text-gray-500">
                  This phone can no longer sync with your shop.
                </p>
              ) : renaming === device.deviceId ? (
                <div className="mt-2 flex flex-col gap-2">
                  <label className="text-sm text-gray-700" htmlFor={`name-${device.deviceId}`}>
                    What do you call this phone?
                  </label>
                  <input
                    id={`name-${device.deviceId}`}
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    maxLength={MAX_LABEL}
                    placeholder="counter phone"
                    className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
                    data-testid={`device-rename-input-${device.deviceId}`}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void rename(device)}
                      className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-55"
                      data-testid={`device-rename-save-${device.deviceId}`}
                    >
                      {working ? "Saving…" : "Save name"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRenaming(null);
                        setTyped("");
                        setProblem(null);
                      }}
                      className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : confirming === device.deviceId ? (
                <div className="mt-2 flex flex-col gap-2">
                  <p className="text-sm text-gray-700">{REVOKE_EXPLANATION}</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void revoke(device)}
                      className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-55"
                      data-testid={`device-revoke-confirm-${device.deviceId}`}
                    >
                      {working ? "Signing out…" : `Sign out ${nameOf(device)}`}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(null)}
                      className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800"
                    >
                      Keep it signed in
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRenaming(device.deviceId);
                      setTyped(device.label ?? "");
                      setProblem(null);
                    }}
                    className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800"
                    data-testid={`device-rename-${device.deviceId}`}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(device.deviceId)}
                    className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800"
                    data-testid={`device-revoke-${device.deviceId}`}
                  >
                    Sign out
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
