"use client";

/**
 * UUID Generator — Security category (TOOL-003).
 *
 * Composed from shared platform pieces (DevToolLayout, CopyButton, files.downloadText)
 * over the pure lib/security/uuid engine — which itself reuses lib/dev/crypto for the
 * v3/v5 hashing. Two modes: Generate (v1/v3/v4/v5/v7, bulk, namespaces) and Validate
 * (version/variant/timestamp inspection). All randomness is Web Crypto; nothing leaves
 * the browser.
 */

import { useCallback, useEffect, useState } from "react";
import { DevToolLayout } from "@/features/dev/DevToolLayout";
import { CopyButton } from "@/features/tool/CopyButton";
import { downloadText } from "@/lib/dev/files";
import {
  uuidV1,
  uuidV3,
  uuidV4,
  uuidV5,
  uuidV7,
  NAMESPACES,
  formatUuid,
  inspectUuid,
  resolveNamespace,
  versionInfo,
  type UuidVersion,
  type NamespaceKey,
  type FormatOptions,
} from "@/lib/security/uuid";

const VERSIONS: UuidVersion[] = [1, 3, 4, 5, 7];
const NAME_BASED = (v: UuidVersion) => v === 3 || v === 5;
const QUANTITIES = [1, 10, 50, 100, 1000];
const NS_KEYS: (NamespaceKey | "custom")[] = ["DNS", "URL", "OID", "X500", "custom"];

export function UuidGenerator() {
  const [mode, setMode] = useState<"generate" | "validate">("generate");
  const [fmt, setFmt] = useState<FormatOptions>({ uppercase: false, hyphens: true });

  return (
    <DevToolLayout
      controls={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Mode"
            className="inline-flex rounded-lg border border-gray-300 p-0.5"
          >
            {(["generate", "validate"] as const).map((m) => (
              <button
                key={m}
                role="tab"
                type="button"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={
                  "rounded-md px-4 py-1.5 text-sm font-medium capitalize transition " +
                  (mode === m ? "bg-brand-600 text-white" : "text-gray-600 hover:bg-gray-100")
                }
              >
                {m}
              </button>
            ))}
          </div>
          {mode === "generate" && (
            <div className="flex flex-wrap items-center gap-3">
              <Toggle
                id="uuid-upper"
                label="Uppercase"
                checked={fmt.uppercase}
                onChange={(v) => setFmt({ ...fmt, uppercase: v })}
              />
              <Toggle
                id="uuid-hyphens"
                label="Hyphens"
                checked={fmt.hyphens}
                onChange={(v) => setFmt({ ...fmt, hyphens: v })}
              />
            </div>
          )}
        </div>
      }
      input={mode === "generate" ? <GeneratePanel fmt={fmt} /> : <ValidatePanel />}
      output={
        <p className="text-xs text-gray-500">
          A UUID is a 128-bit identifier that is unique without any central coordinator.{" "}
          <strong>v4</strong> (random) is the everyday default; <strong>v7</strong> is time-ordered
          and database-friendly; <strong>v3/v5</strong> are deterministic from a namespace and name.
          Generated with the Web Crypto API — never Math.random.
        </p>
      }
    />
  );
}

// ─── Generate ────────────────────────────────────────────────────────────────

function GeneratePanel({ fmt }: { fmt: FormatOptions }) {
  const [version, setVersion] = useState<UuidVersion>(4);
  const [quantity, setQuantity] = useState(10);
  const [nsKey, setNsKey] = useState<NamespaceKey | "custom">("DNS");
  const [customNs, setCustomNs] = useState("");
  const [name, setName] = useState("");
  const [uuids, setUuids] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    setError(null);
    if (NAME_BASED(version)) {
      const ns = resolveNamespace(nsKey, customNs);
      if (ns === null) {
        setError("Enter a valid custom namespace UUID.");
        setUuids([]);
        return;
      }
      if (name === "") {
        setUuids([]);
        return;
      }
      const one = version === 3 ? await uuidV3(ns, name) : await uuidV5(ns, name);
      setUuids([one]);
      return;
    }
    const gen = version === 1 ? uuidV1 : version === 7 ? uuidV7 : uuidV4;
    const out: string[] = [];
    // v1/v7 take (now) as first arg; v4 ignores it — a harmless extra argument.
    for (let i = 0; i < quantity; i++) out.push((gen as (n?: number) => string)());
    setUuids(out);
  }, [version, quantity, nsKey, customNs, name]);

  useEffect(() => {
    void generate();
  }, [generate]);

  const formatted = uuids.map((u) => formatUuid(u, fmt));
  const allText = formatted.join("\n");

  return (
    <div className="flex flex-col gap-4">
      {/* Version selector */}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          Version
        </legend>
        <div role="radiogroup" aria-label="UUID version" className="flex flex-wrap gap-2">
          {VERSIONS.map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={version === v}
              onClick={() => setVersion(v)}
              className={
                "rounded-lg border px-3 py-1.5 text-sm font-medium transition " +
                (version === v
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-gray-300 text-gray-700 hover:border-brand-300")
              }
            >
              v{v}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500">{versionInfo(version)}</p>
      </fieldset>

      {/* Name-based inputs OR quantity */}
      {NAME_BASED(version) ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <label htmlFor="uuid-ns" className="text-sm font-medium text-gray-700">
              Namespace
            </label>
            <select
              id="uuid-ns"
              value={nsKey}
              onChange={(e) => setNsKey(e.target.value as NamespaceKey | "custom")}
              className="w-fit rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800"
            >
              {NS_KEYS.map((k) => (
                <option key={k} value={k}>
                  {k === "custom" ? "Custom…" : `${k} (${NAMESPACES[k as NamespaceKey]})`}
                </option>
              ))}
            </select>
          </div>
          {nsKey === "custom" && (
            <div className="flex flex-col gap-2">
              <label htmlFor="uuid-custom-ns" className="text-sm font-medium text-gray-700">
                Custom namespace UUID
              </label>
              <input
                id="uuid-custom-ns"
                type="text"
                value={customNs}
                onChange={(e) => setCustomNs(e.target.value)}
                placeholder="e.g. 6ba7b810-9dad-11d1-80b4-00c04fd430c8"
                spellCheck={false}
                className="rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm text-gray-800"
              />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <label htmlFor="uuid-name" className="text-sm font-medium text-gray-700">
              Name
            </label>
            <input
              id="uuid-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. example.com"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800"
            />
            <p className="text-xs text-gray-400">
              The same namespace + name always produces the same UUID.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <label htmlFor="uuid-qty" className="text-sm font-medium text-gray-700">
            How many
          </label>
          <select
            id="uuid-qty"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-800"
          >
            {QUANTITIES.map((q) => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void generate()}
            className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            ↻ Regenerate
          </button>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {/* Actions */}
      {formatted.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
          <CopyButton value={allText} label={`Copy ${formatted.length > 1 ? "all" : ""}`.trim()} />
          <ActionButton onClick={() => downloadText("uuids.txt", allText)}>
            Download .txt
          </ActionButton>
          <ActionButton
            onClick={() =>
              downloadText(
                "uuids.csv",
                "index,uuid\n" + formatted.map((u, i) => `${i + 1},${u}`).join("\n"),
                "text/csv;charset=utf-8"
              )
            }
          >
            Download .csv
          </ActionButton>
          <ActionButton onClick={() => setUuids([])}>Clear</ActionButton>
        </div>
      )}

      {/* Output list */}
      {formatted.length > 0 && (
        <ul aria-label="Generated UUIDs" className="flex max-h-96 flex-col gap-1.5 overflow-y-auto">
          {formatted.map((u, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-1.5"
            >
              <span className="min-w-0 flex-1 break-all font-mono text-sm text-gray-800">{u}</span>
              <CopyButton value={u} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Validate ────────────────────────────────────────────────────────────────

function ValidatePanel() {
  const [input, setInput] = useState("");
  const result = input.trim() === "" ? null : inspectUuid(input);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="uuid-validate" className="text-sm font-medium text-gray-700">
          Paste a UUID to inspect
        </label>
        <input
          id="uuid-validate"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="6fa459ea-ee8a-3ca4-894e-db77e160355e"
          spellCheck={false}
          autoComplete="off"
          className="rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm text-gray-800"
        />
      </div>

      {result && (
        <div
          role="status"
          aria-live="polite"
          className={
            "flex flex-col gap-3 rounded-xl border p-4 " +
            (result.valid ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50")
          }
        >
          <p
            className={
              "flex items-center gap-2 text-sm font-semibold " +
              (result.valid ? "text-green-700" : "text-red-700")
            }
          >
            {result.valid ? "✓ Valid UUID" : "✗ Invalid"}
          </p>
          {result.error && <p className="text-sm text-red-700">{result.error}</p>}
          {result.valid && (
            <dl className="flex flex-col gap-2 text-sm">
              <Row term="Version">
                <strong>
                  {typeof result.version === "number" ? `v${result.version}` : result.version}
                </strong>{" "}
                — {result.versionInfo}
              </Row>
              {result.variant && (
                <Row term="Variant">
                  <strong>{result.variant.label}</strong> — {result.variant.detail}
                </Row>
              )}
              {result.timestamp && (
                <Row term="Timestamp">
                  <span className="font-mono">{result.timestamp.toISOString()}</span>
                </Row>
              )}
            </dl>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Small shared bits ───────────────────────────────────────────────────────

function Row({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
      <dt className="w-24 shrink-0 text-xs font-medium uppercase tracking-widest text-gray-400">
        {term}
      </dt>
      <dd className="flex-1 text-gray-700">{children}</dd>
    </div>
  );
}

function ActionButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
    >
      {children}
    </button>
  );
}

function Toggle({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300 accent-brand-600"
      />
      {label}
    </label>
  );
}
