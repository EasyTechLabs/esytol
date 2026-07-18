"use client";

/**
 * JWT Decoder & Verifier — Security category (TOOL-004).
 *
 * A teaching tool, not just a decoder. It reuses the shared decode (lib/dev/parse.
 * parseJwt) and HS256 verification (lib/dev/crypto.verifyJwtHs256), and adds the
 * educational layer (lib/security/jwtInsights): every claim explained, human-readable
 * timestamps, a live expiry countdown, and technically-correct security warnings.
 *
 * Everything runs locally — the token is never transmitted, and no secret is exposed.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { DevToolLayout } from "@/features/dev/DevToolLayout";
import { EverydayInput } from "@/features/everyday/EverydayInput";
import { CopyButton } from "@/features/tool/CopyButton";
import { downloadText } from "@/lib/dev/files";
import { parseJwt, type JwtParts } from "@/lib/dev/parse";
import { verifyJwtHs256 } from "@/lib/dev/crypto";
import {
  explainHeader,
  explainPayload,
  analyzeTemporal,
  relativeTime,
  securityNotes,
  algFamily,
  isVerifiableHere,
  type ClaimExplanation,
  type Severity,
  type SecurityNote,
} from "@/lib/security/jwtInsights";

// The canonical jwt.io example token (HS256, secret "your-256-bit-secret"). It is a
// public, well-known test vector — not a real credential — and its signature verifies
// against that secret, so the playground's Verify button demonstrates a real success.
const SAMPLE_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

export function JwtDecoder() {
  const [token, setToken] = useState("");

  const decoded = useMemo(() => (token.trim() === "" ? null : parseJwt(token)), [token]);
  const jwt = decoded?.ok ? decoded.value : null;

  return (
    <DevToolLayout
      input={
        <div className="flex flex-col gap-3">
          <EverydayInput
            value={token}
            onChange={setToken}
            label="JWT"
            placeholder="Paste a JSON Web Token — header.payload.signature"
            sample={SAMPLE_JWT}
            rows={5}
            ariaLabel="JSON Web Token"
          />
          {decoded && !decoded.ok && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {decoded.validation.message}
              {decoded.validation.detail ? ` — ${decoded.validation.detail}` : ""}
            </p>
          )}
        </div>
      }
      output={
        jwt ? (
          <Decoded jwt={jwt} />
        ) : (
          <p className="text-xs text-gray-500">
            A JWT has three Base64url parts separated by dots:{" "}
            <span className="font-mono">header.payload.signature</span>. Paste one (or load the
            sample) to decode every field, see human-readable timestamps and expiry, verify an HS256
            signature, and read a plain-English security analysis. Decoding happens entirely in your
            browser — the token is never uploaded.
          </p>
        )
      }
    />
  );
}

function Decoded({ jwt }: { jwt: JwtParts }) {
  const alg = jwt.header.alg;
  const family = algFamily(alg);

  // Live-updating "now" so the expiry countdown ticks, only while an exp exists.
  const [now, setNow] = useState(() => Date.now());
  const hasExp = typeof jwt.payload.exp === "number";
  useEffect(() => {
    if (!hasExp) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hasExp]);

  const temporal = useMemo(() => analyzeTemporal(jwt.payload, now), [jwt.payload, now]);

  // HS256 verification state (only meaningful for HS256).
  const [secret, setSecret] = useState("");
  const [verified, setVerified] = useState<boolean | undefined>(undefined);
  const [verifyReason, setVerifyReason] = useState<string>("");
  const rawToken = `${jwt.raw.header}.${jwt.raw.payload}.${jwt.raw.signature}`;

  const runVerify = useCallback(async () => {
    if (!isVerifiableHere(alg) || secret === "") return;
    const r = await verifyJwtHs256(rawToken, secret);
    setVerified(r.verified);
    setVerifyReason(r.reason);
  }, [alg, secret, rawToken]);

  const notes = useMemo(
    () => securityNotes(jwt.header, temporal, verified),
    [jwt.header, temporal, verified]
  );

  const decodedJson = useMemo(
    () => JSON.stringify({ header: jwt.header, payload: jwt.payload }, null, 2),
    [jwt.header, jwt.payload]
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Expiry banner */}
      {temporal.hasExp && (
        <div
          className={
            "rounded-lg px-4 py-2 text-sm font-medium " +
            (temporal.expired ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700")
          }
          role="status"
          aria-live="polite"
        >
          {temporal.expired
            ? `⏱ Expired ${relativeTime(temporal.msUntilExpiry ?? 0)}`
            : `⏱ Expires ${relativeTime(temporal.msUntilExpiry ?? 0)}`}
        </div>
      )}

      {/* Header + Payload */}
      <Segment title="Header" json={jwt.header} claims={explainHeader(jwt.header)} />
      <Segment title="Payload" json={jwt.payload} claims={explainPayload(jwt.payload)} />

      {/* Signature + verification */}
      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-gray-900">Signature</h3>
        <p className="mt-2 break-all rounded-lg bg-gray-50 px-3 py-2 font-mono text-xs text-gray-700">
          {jwt.signature || <span className="text-gray-400">(empty — unsigned token)</span>}
        </p>

        {isVerifiableHere(alg) ? (
          <div className="mt-3 flex flex-col gap-2">
            <label htmlFor="jwt-secret" className="text-sm font-medium text-gray-700">
              Verify HS256 signature — enter the shared secret
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="jwt-secret"
                type="text"
                value={secret}
                onChange={(e) => {
                  setSecret(e.target.value);
                  setVerified(undefined);
                }}
                placeholder="your-256-bit-secret"
                autoComplete="off"
                spellCheck={false}
                className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm text-gray-800"
              />
              <button
                type="button"
                onClick={() => void runVerify()}
                disabled={secret === ""}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
              >
                Verify
              </button>
            </div>
            {verified !== undefined && (
              <p
                role="status"
                aria-live="polite"
                className={"text-sm font-medium " + (verified ? "text-green-700" : "text-red-700")}
              >
                {verified ? "✓ " : "✗ "}
                {verifyReason}
              </p>
            )}
          </div>
        ) : (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {family === "none"
              ? "This token declares alg: none — there is no signature to verify."
              : `This token uses ${String(
                  alg
                )}, which is verified with the issuer's public key (not a shared secret). This tool cannot verify it in the browser — decoding is not verification.`}
          </p>
        )}
      </section>

      {/* Security analysis */}
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-gray-900">Security analysis</h3>
        <ul className="flex flex-col gap-2" aria-label="Security analysis">
          {notes.map((n, i) => (
            <NoteRow key={i} note={n} />
          ))}
        </ul>
      </section>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
        <CopyButton value={decodedJson} label="Copy decoded JSON" />
        <button
          type="button"
          onClick={() => downloadText("jwt-decoded.json", decodedJson, "application/json")}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          Download .json
        </button>
      </div>
    </div>
  );
}

// ─── Segment (header/payload) ────────────────────────────────────────────────

function Segment({
  title,
  json,
  claims,
}: {
  title: string;
  json: Record<string, unknown>;
  claims: ClaimExplanation[];
}) {
  const pretty = JSON.stringify(json, null, 2);
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <CopyButton value={pretty} />
      </div>
      <pre className="mt-2 overflow-x-auto rounded-lg bg-gray-900 px-3 py-2 text-xs text-gray-100">
        <code>{pretty}</code>
      </pre>
      <dl className="mt-3 flex flex-col gap-2">
        {claims.map((c) => (
          <div key={c.key} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
            <dt className="w-28 shrink-0">
              <span className="font-mono text-xs font-semibold text-gray-900">{c.key}</span>
              <span className="block text-[10px] uppercase tracking-wider text-gray-400">
                {c.known ? c.label : "custom"}
              </span>
            </dt>
            <dd className="flex-1 text-xs text-gray-600">
              {c.description}
              {c.time && (
                <span className="mt-0.5 block font-mono text-gray-800">
                  = {c.time} ({relativeTime(new Date(c.time).getTime() - Date.now())})
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// ─── Security note row ───────────────────────────────────────────────────────

const SEVERITY_STYLE: Record<Severity, { box: string; tag: string; label: string }> = {
  critical: { box: "border-red-300 bg-red-50", tag: "bg-red-600", label: "Critical" },
  warning: { box: "border-amber-300 bg-amber-50", tag: "bg-amber-500", label: "Warning" },
  info: { box: "border-blue-200 bg-blue-50", tag: "bg-blue-500", label: "Info" },
  ok: { box: "border-green-300 bg-green-50", tag: "bg-green-600", label: "OK" },
};

function NoteRow({ note }: { note: SecurityNote }) {
  const s = SEVERITY_STYLE[note.severity];
  return (
    <li className={"flex flex-col gap-1 rounded-lg border p-3 " + s.box}>
      <div className="flex items-center gap-2">
        <span className={"rounded-full px-2 py-0.5 text-[10px] font-semibold text-white " + s.tag}>
          {s.label}
        </span>
        <span className="text-sm font-semibold text-gray-900">{note.title}</span>
      </div>
      <p className="text-xs text-gray-700">{note.detail}</p>
    </li>
  );
}
