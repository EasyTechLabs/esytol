"use client";

/**
 * The Udharpe administrator panel.
 *
 * Three jobs and no more, because that is all an administrator can do:
 * review shopkeeper applications, decide escalated disputes, and read the
 * audit trail. There is no ledger view and no balance anywhere in this file —
 * an administrator reviews an application, not a shop's books.
 *
 * ## Every negative decision asks why, before it is sent
 *
 * Reject, request changes and suspend each require a reason, and the applicant
 * is shown it. The server refuses without one; this asks for it up front so an
 * administrator is not told "no" after typing a decision, and so the reason is
 * written while the evidence is still on screen.
 *
 * ## Nothing here edits an amount
 *
 * Deciding a dispute takes a sentence. There is no amount field, because a
 * figure an administrator typed is not a figure two people agreed on.
 */

import { useCallback, useEffect, useState } from "react";

type ApplicationStatus =
  | "pending"
  | "under_review"
  | "changes_requested"
  | "approved"
  | "rejected"
  | "suspended"
  | "withdrawn";

interface Application {
  applicationId: string;
  status: ApplicationStatus;
  shopName: string;
  shopLocality: string | null;
  decisionReason: string | null;
}

interface Dispute {
  disputeId: string;
  subjectKind: string;
  subjectId: string;
  status: string;
  raisedBy: string;
  claim: string;
  resolution: string | null;
}

interface AuditEvent {
  auditId: string;
  at: string;
  actorIsAdmin: boolean;
  action: string;
  objectKind: string;
  objectId: string;
  previousState: string | null;
  newState: string | null;
  reason: string | null;
}

const API = "/api/udharpe-admin";

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(body?.error?.message ?? `Request failed (${response.status})`);
  }
  return body as T;
}

// ── Sign-in ──────────────────────────────────────────────────────────────────

function SignIn({ onSignedIn }: { onSignedIn: (email: string | null) => void }) {
  const [stage, setStage] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const request = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await call("/auth/request-code", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      setStage("code");
    } catch (e) {
      setProblem((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    setProblem(null);
    try {
      // The token is set as an httpOnly cookie by the forwarder and never
      // reaches this component.
      const result = await call<{ email: string | null }>("/auth/verify-code", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), code: code.trim() }),
      });
      onSignedIn(result.email);
    } catch (e) {
      setProblem((e as Error).message);
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto mt-24 w-full max-w-sm rounded-lg border border-neutral-200 p-6">
      <h1 className="text-lg font-semibold">Udharpe administration</h1>
      <p className="mt-1 text-sm text-neutral-600">
        {stage === "email"
          ? "Sign in with your administrator account."
          : `If ${email} has an inbox, a six-digit code is on its way.`}
      </p>

      {problem ? (
        <p className="mt-4 rounded border border-red-300 bg-red-50 p-2 text-sm text-red-800">
          {problem}
        </p>
      ) : null}

      {stage === "email" ? (
        <>
          <input
            className="mt-4 w-full rounded border border-neutral-300 px-3 py-2"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button
            className="mt-3 w-full rounded bg-neutral-900 px-3 py-2 text-white disabled:opacity-50"
            disabled={busy || email.trim() === ""}
            onClick={() => void request()}
          >
            {busy ? "Sending…" : "Send me a code"}
          </button>
        </>
      ) : (
        <>
          <input
            className="mt-4 w-full rounded border border-neutral-300 px-3 py-2 tracking-widest"
            inputMode="numeric"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button
            className="mt-3 w-full rounded bg-neutral-900 px-3 py-2 text-white disabled:opacity-50"
            disabled={busy || code.trim().length !== 6}
            onClick={() => void verify()}
          >
            {busy ? "Checking…" : "Sign in"}
          </button>
        </>
      )}
    </div>
  );
}

// ── Applications ─────────────────────────────────────────────────────────────

const STATUSES: ApplicationStatus[] = [
  "pending",
  "under_review",
  "changes_requested",
  "approved",
  "rejected",
  "suspended",
];

function Applications() {
  const [status, setStatus] = useState<ApplicationStatus>("pending");
  const [items, setItems] = useState<Application[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (s: ApplicationStatus) => {
    setProblem(null);
    try {
      const body = await call<{ items: Application[] }>(`/applications?status=${s}`);
      setItems(body.items);
    } catch (e) {
      setProblem((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load(status);
  }, [status, load]);

  const decide = async (id: string, action: string, needsReason: boolean) => {
    let reason: string | null = null;
    if (needsReason) {
      // Asked before the request, so the applicant is never told "no" without
      // one and the reason is written while the evidence is still on screen.
      reason = window.prompt("Why? The applicant is shown this.");
      if (reason === null || reason.trim() === "") return;
    }
    setBusy(true);
    try {
      await call(`/applications/${id}/${action}`, {
        method: "POST",
        body: JSON.stringify(reason ? { reason } : {}),
      });
      await load(status);
    } catch (e) {
      setProblem((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded px-3 py-1 text-sm ${
              s === status ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-700"
            }`}
          >
            {s.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {problem ? <p className="mt-4 text-sm text-red-700">{problem}</p> : null}

      {items.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-600">Nothing {status.replace(/_/g, " ")}.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((a) => (
            <li key={a.applicationId} className="rounded border border-neutral-200 p-4">
              <div className="flex items-baseline justify-between gap-4">
                <span className="font-medium">{a.shopName}</span>
                <span className="text-xs uppercase tracking-wide text-neutral-500">
                  {a.status.replace(/_/g, " ")}
                </span>
              </div>
              {a.shopLocality ? <p className="text-sm text-neutral-600">{a.shopLocality}</p> : null}
              {a.decisionReason ? (
                <p className="mt-2 text-sm text-neutral-700">
                  <span className="text-neutral-500">Reason given: </span>
                  {a.decisionReason}
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                {a.status === "pending" ? (
                  <Action
                    label="Open for review"
                    onClick={() => decide(a.applicationId, "open", false)}
                    busy={busy}
                  />
                ) : null}
                {a.status === "under_review" ? (
                  <>
                    <Action
                      label="Approve"
                      onClick={() => decide(a.applicationId, "approve", false)}
                      busy={busy}
                    />
                    <Action
                      label="Request changes"
                      onClick={() => decide(a.applicationId, "request-changes", true)}
                      busy={busy}
                    />
                    <Action
                      label="Reject"
                      onClick={() => decide(a.applicationId, "reject", true)}
                      busy={busy}
                    />
                  </>
                ) : null}
                {a.status === "approved" ? (
                  <Action
                    label="Suspend"
                    onClick={() => decide(a.applicationId, "suspend", true)}
                    busy={busy}
                  />
                ) : null}
                {a.status === "suspended" ? (
                  <Action
                    label="Reinstate"
                    onClick={() => decide(a.applicationId, "reinstate", false)}
                    busy={busy}
                  />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Action({ label, onClick, busy }: { label: string; onClick: () => void; busy: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="rounded border border-neutral-300 px-3 py-1 text-sm hover:bg-neutral-50 disabled:opacity-50"
    >
      {label}
    </button>
  );
}

// ── Disputes ─────────────────────────────────────────────────────────────────

function Disputes() {
  const [items, setItems] = useState<Dispute[]>([]);
  const [problem, setProblem] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const body = await call<{ items: Dispute[] }>("/disputes");
      setItems(body.items);
    } catch (e) {
      setProblem((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (id: string) => {
    // A sentence, and no amount field. A figure an administrator typed is not
    // a figure two people agreed on.
    const reason = window.prompt("How was this decided? Both sides are shown this.");
    if (reason === null || reason.trim() === "") return;
    try {
      await call(`/disputes/${id}/decide`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      await load();
    } catch (e) {
      setProblem((e as Error).message);
    }
  };

  return (
    <section>
      {problem ? <p className="text-sm text-red-700">{problem}</p> : null}
      {items.length === 0 ? (
        <p className="text-sm text-neutral-600">No escalated disputes.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((d) => (
            <li key={d.disputeId} className="rounded border border-neutral-200 p-4">
              <p className="text-sm text-neutral-500">
                Raised by the {d.raisedBy} · {d.subjectKind}
              </p>
              <p className="mt-1">{d.claim}</p>
              <div className="mt-3">
                <Action label="Decide" onClick={() => decide(d.disputeId)} busy={false} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Audit ────────────────────────────────────────────────────────────────────

function Audit() {
  const [items, setItems] = useState<AuditEvent[]>([]);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const body = await call<{ items: AuditEvent[] }>("/audit?limit=100");
        setItems(body.items);
      } catch (e) {
        setProblem((e as Error).message);
      }
    })();
  }, []);

  return (
    <section>
      {problem ? <p className="text-sm text-red-700">{problem}</p> : null}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="py-2 pr-4">When</th>
              <th className="py-2 pr-4">Action</th>
              <th className="py-2 pr-4">Object</th>
              <th className="py-2 pr-4">Change</th>
              <th className="py-2">Reason</th>
            </tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr key={e.auditId} className="border-t border-neutral-100">
                <td className="whitespace-nowrap py-2 pr-4 text-neutral-600">
                  {new Date(e.at).toLocaleString()}
                </td>
                <td className="py-2 pr-4">
                  {e.action}
                  {e.actorIsAdmin ? (
                    <span className="ml-2 rounded bg-neutral-100 px-1 text-xs">admin</span>
                  ) : null}
                </td>
                <td className="py-2 pr-4 text-neutral-600">{e.objectKind}</td>
                <td className="py-2 pr-4 text-neutral-600">
                  {e.previousState ? `${e.previousState} → ` : ""}
                  {e.newState ?? ""}
                </td>
                <td className="py-2 text-neutral-700">{e.reason ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── The panel ────────────────────────────────────────────────────────────────

export function AdminPanel() {
  const [signedIn, setSignedIn] = useState<string | null | false>(false);
  const [tab, setTab] = useState<"applications" | "disputes" | "audit">("applications");

  if (signedIn === false) return <SignIn onSignedIn={(email) => setSignedIn(email)} />;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="text-xl font-semibold">Udharpe administration</h1>
        <button
          className="text-sm text-neutral-600 underline"
          onClick={() => {
            void call("/auth/logout", { method: "POST" }).finally(() => setSignedIn(false));
          }}
        >
          Sign out
        </button>
      </header>

      <nav className="mt-6 flex gap-2">
        {(["applications", "disputes", "audit"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded px-3 py-1 text-sm ${
              t === tab ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-700"
            }`}
          >
            {t}
          </button>
        ))}
      </nav>

      <div className="mt-8">
        {tab === "applications" ? <Applications /> : null}
        {tab === "disputes" ? <Disputes /> : null}
        {tab === "audit" ? <Audit /> : null}
      </div>
    </main>
  );
}
