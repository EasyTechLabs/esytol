"use client";

/**
 * Hash Generator — Security category (TOOL-002).
 *
 * Wraps the shared, tested crypto library (lib/dev/crypto) — it adds no new
 * algorithm, only the UI and the file/checksum-verification workflow. Three modes:
 *  - Text  → live MD5 / SHA-1 / SHA-256 / SHA-512 of typed text
 *  - File  → checksums of a dropped/selected file (raw bytes), with verify
 *  - HMAC  → keyed hash of a message with a secret
 *
 * All hashing runs in the browser via Web Crypto (SubtleCrypto) + a pure MD5;
 * nothing is uploaded. Computation is async, so results update after each change.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { DevToolLayout } from "@/features/dev/DevToolLayout";
import { EverydayInput } from "@/features/everyday/EverydayInput";
import { CopyButton } from "@/features/tool/CopyButton";
import { hashAll, hashAllBytes, hmac, type HashAlgorithm } from "@/lib/dev/crypto";
import { readBinaryFile, DEFAULT_MAX_FILE_BYTES } from "@/lib/dev/files";

type Mode = "text" | "file" | "hmac";
type HmacAlgo = "SHA-1" | "SHA-256" | "SHA-512";

const ALGOS: HashAlgorithm[] = ["MD5", "SHA-1", "SHA-256", "SHA-512"];
const EMPTY_DIGESTS: Record<HashAlgorithm, string> = {
  MD5: "",
  "SHA-1": "",
  "SHA-256": "",
  "SHA-512": "",
};
const SAMPLE = "The quick brown fox jumps over the lazy dog";

export function HashGenerator() {
  const [mode, setMode] = useState<Mode>("text");
  const [upper, setUpper] = useState(false);
  const [expected, setExpected] = useState("");

  return (
    <DevToolLayout
      controls={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Hash input mode"
            className="inline-flex rounded-lg border border-gray-300 p-0.5"
          >
            {(["text", "file", "hmac"] as Mode[]).map((m) => (
              <button
                key={m}
                role="tab"
                type="button"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={
                  "rounded-md px-4 py-1.5 text-sm font-medium uppercase transition " +
                  (mode === m ? "bg-brand-600 text-white" : "text-gray-600 hover:bg-gray-100")
                }
              >
                {m}
              </button>
            ))}
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={upper}
              onChange={(e) => setUpper(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 accent-brand-600"
            />
            Uppercase hex
          </label>
        </div>
      }
      input={
        mode === "hmac" ? (
          <HmacPanel upper={upper} />
        ) : mode === "file" ? (
          <FilePanel upper={upper} expected={expected} setExpected={setExpected} />
        ) : (
          <TextPanel upper={upper} expected={expected} setExpected={setExpected} />
        )
      }
      output={
        mode === "hmac" ? (
          <p className="text-xs text-gray-500">
            HMAC combines your message and secret key into a keyed hash — used to verify both the
            integrity and the authenticity of a message.
          </p>
        ) : (
          <p className="text-xs text-gray-500">
            A hash is a fixed-length fingerprint of your input. The same input always produces the
            same hash; the smallest change produces a completely different one. Use{" "}
            <strong>SHA-256</strong> for integrity checks — MD5 and SHA-1 are shown for legacy
            checksums only and are not safe against a determined attacker.
          </p>
        )
      }
    />
  );
}

// ─── Text mode ───────────────────────────────────────────────────────────────

function TextPanel({
  upper,
  expected,
  setExpected,
}: {
  upper: boolean;
  expected: string;
  setExpected: (v: string) => void;
}) {
  const [text, setText] = useState("");
  const [digests, setDigests] = useState<Record<HashAlgorithm, string>>(EMPTY_DIGESTS);

  useEffect(() => {
    let active = true;
    hashAll(text).then((d) => {
      if (active) setDigests(d);
    });
    return () => {
      active = false;
    };
  }, [text]);

  return (
    <div className="flex flex-col gap-4">
      <EverydayInput
        value={text}
        onChange={setText}
        label="Text to hash"
        placeholder="Type or paste any text — hashes update as you type…"
        sample={SAMPLE}
        rows={5}
        ariaLabel="Text to hash"
      />
      <DigestList digests={digests} upper={upper} expected={expected} />
      <VerifyField expected={expected} setExpected={setExpected} digests={digests} />
    </div>
  );
}

// ─── File mode ───────────────────────────────────────────────────────────────

function FilePanel({
  upper,
  expected,
  setExpected,
}: {
  upper: boolean;
  expected: string;
  setExpected: (v: string) => void;
}) {
  const [digests, setDigests] = useState<Record<HashAlgorithm, string>>(EMPTY_DIGESTS);
  const [fileName, setFileName] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "hashing" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setStatus("hashing");
    setError(null);
    setFileName(file.name);
    const res = await readBinaryFile(file);
    if (!res.ok) {
      setStatus("error");
      setError(res.error ?? "Could not read file.");
      setDigests(EMPTY_DIGESTS);
      return;
    }
    const d = await hashAllBytes(res.bytes);
    setDigests(d);
    setStatus("idle");
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Choose or drop a file to hash"
        className={
          "flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed px-4 py-8 text-center transition " +
          (dragging ? "border-brand-500 bg-brand-50" : "border-gray-300 hover:border-brand-400")
        }
      >
        <span className="text-2xl" aria-hidden>
          📄
        </span>
        <span className="text-sm font-medium text-gray-700">
          {fileName ?? "Drop a file here, or click to choose"}
        </span>
        <span className="text-xs text-gray-400">
          Up to {(DEFAULT_MAX_FILE_BYTES / (1024 * 1024)).toFixed(0)} MB · never uploaded
        </span>
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>

      {status === "hashing" && <p className="text-sm text-gray-500">Hashing {fileName}…</p>}
      {status === "error" && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {status === "idle" && fileName && (
        <>
          <DigestList digests={digests} upper={upper} expected={expected} />
          <VerifyField expected={expected} setExpected={setExpected} digests={digests} />
        </>
      )}
    </div>
  );
}

// ─── HMAC mode ───────────────────────────────────────────────────────────────

function HmacPanel({ upper }: { upper: boolean }) {
  const [message, setMessage] = useState("");
  const [secret, setSecret] = useState("");
  const [algo, setAlgo] = useState<HmacAlgo>("SHA-256");
  const [result, setResult] = useState("");

  useEffect(() => {
    let active = true;
    if (!secret) {
      setResult("");
      return;
    }
    hmac(message, secret, algo).then((r) => {
      if (active) setResult(r);
    });
    return () => {
      active = false;
    };
  }, [message, secret, algo]);

  const shown = upper ? result.toUpperCase() : result;

  return (
    <div className="flex flex-col gap-4">
      <EverydayInput
        value={message}
        onChange={setMessage}
        label="Message"
        placeholder="The message to authenticate…"
        rows={3}
        ariaLabel="HMAC message"
      />
      <div className="flex flex-col gap-2">
        <label htmlFor="hmac-secret" className="text-sm font-medium text-gray-700">
          Secret key
        </label>
        <input
          id="hmac-secret"
          type="text"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="Shared secret"
          autoComplete="off"
          spellCheck={false}
          className="rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm text-gray-800"
        />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="hmac-algo" className="text-sm font-medium text-gray-700">
          Algorithm
        </label>
        <select
          id="hmac-algo"
          value={algo}
          onChange={(e) => setAlgo(e.target.value as HmacAlgo)}
          className="w-fit rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800"
        >
          {(["SHA-256", "SHA-1", "SHA-512"] as HmacAlgo[]).map((a) => (
            <option key={a} value={a}>
              HMAC-{a}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-widest text-gray-400">
            HMAC-{algo}
          </span>
          <CopyButton value={shown} disabled={!shown} />
        </div>
        <p className="break-all font-mono text-sm text-gray-800" aria-live="polite">
          {secret ? shown || "…" : <span className="text-gray-400">Enter a secret key</span>}
        </p>
      </div>
    </div>
  );
}

// ─── Shared output pieces ────────────────────────────────────────────────────

function DigestList({
  digests,
  upper,
  expected,
}: {
  digests: Record<HashAlgorithm, string>;
  upper: boolean;
  expected: string;
}) {
  const normExpected = expected.trim().toLowerCase();
  return (
    <ul className="flex flex-col gap-2" aria-label="Hash digests">
      {ALGOS.map((algo) => {
        const value = digests[algo];
        const shown = upper ? value.toUpperCase() : value;
        const isMatch = normExpected.length > 0 && value !== "" && value === normExpected;
        return (
          <li
            key={algo}
            className={
              "flex items-center justify-between gap-3 rounded-lg border px-3 py-2 " +
              (isMatch ? "border-green-400 bg-green-50" : "border-gray-200 bg-white")
            }
          >
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-gray-400">
                {algo}
                {isMatch && (
                  <span className="rounded-full bg-green-600 px-1.5 py-0.5 text-[10px] text-white">
                    match
                  </span>
                )}
              </span>
              <span className="block break-all font-mono text-sm text-gray-800">
                {shown || "—"}
              </span>
            </span>
            <CopyButton value={shown} disabled={value === ""} />
          </li>
        );
      })}
    </ul>
  );
}

function VerifyField({
  expected,
  setExpected,
  digests,
}: {
  expected: string;
  setExpected: (v: string) => void;
  digests: Record<HashAlgorithm, string>;
}) {
  const normExpected = expected.trim().toLowerCase();
  const matched = ALGOS.find((a) => digests[a] !== "" && digests[a] === normExpected);
  const hasInput = normExpected.length > 0;

  return (
    <div className="flex flex-col gap-2 border-t border-gray-100 pt-3">
      <label htmlFor="expected-hash" className="text-sm font-medium text-gray-700">
        Verify a checksum <span className="font-normal text-gray-400">(optional)</span>
      </label>
      <input
        id="expected-hash"
        type="text"
        value={expected}
        onChange={(e) => setExpected(e.target.value)}
        placeholder="Paste an expected hash to compare…"
        autoComplete="off"
        spellCheck={false}
        className="rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm text-gray-800"
      />
      {hasInput &&
        (matched ? (
          <p className="text-sm font-medium text-green-700" role="status">
            ✓ Matches the {matched} digest — the input is authentic.
          </p>
        ) : (
          <p className="text-sm font-medium text-red-600" role="status">
            ✗ No match — the input does not produce this hash.
          </p>
        ))}
    </div>
  );
}
