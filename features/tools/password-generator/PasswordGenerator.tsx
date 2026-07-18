"use client";

/**
 * Password Generator — the Security category's first interactive tool.
 *
 * Only its own controls/output live here; the two-column layout, privacy line and
 * trust surface are shared platform components. Two modes:
 *  - Random characters (length + character-set toggles), and
 *  - Passphrase (Diceware-style words) — easier to remember at equal strength.
 *
 * All randomness is cryptographically secure (see lib/security/password). The first
 * secret is generated on mount (never during SSR), so there is no hydration mismatch
 * and `crypto` is always available when it runs.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { DevToolLayout } from "@/features/dev/DevToolLayout";
import { CopyButton } from "@/features/tool/CopyButton";
import {
  generatePassword,
  generatePassphrase,
  strengthFromEntropy,
  crackTimeText,
  DEFAULT_PASSWORD_OPTIONS,
  DEFAULT_PASSPHRASE_OPTIONS,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
  MIN_PASSPHRASE_WORDS,
  MAX_PASSPHRASE_WORDS,
  type PasswordOptions,
  type PassphraseOptions,
  type Separator,
} from "@/lib/security/password";

type Mode = "password" | "passphrase";

const STRENGTH_STYLES: Record<number, { bar: string; text: string }> = {
  0: { bar: "bg-red-500", text: "text-red-600" },
  1: { bar: "bg-orange-500", text: "text-orange-600" },
  2: { bar: "bg-amber-500", text: "text-amber-600" },
  3: { bar: "bg-lime-600", text: "text-lime-700" },
  4: { bar: "bg-green-600", text: "text-green-700" },
};

const SEPARATORS: { label: string; value: Separator }[] = [
  { label: "Hyphen ( - )", value: "-" },
  { label: "Dot ( . )", value: "." },
  { label: "Underscore ( _ )", value: "_" },
  { label: "Space", value: " " },
  { label: "None", value: "" },
];

const QUANTITIES = [1, 5, 10, 20];

export function PasswordGenerator() {
  const [mode, setMode] = useState<Mode>("password");
  const [pwOpts, setPwOpts] = useState<PasswordOptions>(DEFAULT_PASSWORD_OPTIONS);
  const [ppOpts, setPpOpts] = useState<PassphraseOptions>(DEFAULT_PASSPHRASE_OPTIONS);
  const [quantity, setQuantity] = useState(1);

  // Results: value + entropy per generated secret; error is a single message.
  const [results, setResults] = useState<{ value: string; entropyBits: number }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(() => {
    const out: { value: string; entropyBits: number }[] = [];
    for (let i = 0; i < quantity; i++) {
      const r = mode === "password" ? generatePassword(pwOpts) : generatePassphrase(ppOpts);
      if (!r.ok) {
        setError(r.error);
        setResults([]);
        return;
      }
      out.push({ value: r.value, entropyBits: r.entropyBits });
    }
    setError(null);
    setResults(out);
  }, [mode, pwOpts, ppOpts, quantity]);

  // Regenerate whenever options change (and once on mount). Client-only, so crypto
  // is always present. `generate` captures the latest options via useCallback deps.
  useEffect(() => {
    generate();
  }, [generate]);

  const allValues = useMemo(() => results.map((r) => r.value).join("\n"), [results]);

  return (
    <DevToolLayout
      controls={
        <div
          role="tablist"
          aria-label="Generator mode"
          className="inline-flex rounded-lg border border-gray-300 p-0.5"
        >
          {(["password", "passphrase"] as Mode[]).map((m) => (
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
      }
      input={
        mode === "password" ? (
          <PasswordControls opts={pwOpts} setOpts={setPwOpts} />
        ) : (
          <PassphraseControls opts={ppOpts} setOpts={setPpOpts} />
        )
      }
      output={
        <OutputPanel
          results={results}
          allValues={allValues}
          error={error}
          quantity={quantity}
          setQuantity={setQuantity}
          onRegenerate={generate}
        />
      }
    />
  );
}

// ─── Password controls ───────────────────────────────────────────────────────

function PasswordControls({
  opts,
  setOpts,
}: {
  opts: PasswordOptions;
  setOpts: (o: PasswordOptions) => void;
}) {
  const toggles: { key: keyof PasswordOptions; label: string }[] = [
    { key: "lowercase", label: "Lowercase (a–z)" },
    { key: "uppercase", label: "Uppercase (A–Z)" },
    { key: "numbers", label: "Numbers (0–9)" },
    { key: "symbols", label: "Symbols (!@#…)" },
  ];

  return (
    <fieldset className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4">
      <legend className="px-1 text-xs font-semibold uppercase tracking-widest text-gray-400">
        Password options
      </legend>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label htmlFor="pw-length" className="text-sm font-medium text-gray-700">
            Length
          </label>
          <span className="font-mono text-sm font-semibold text-gray-900" aria-live="polite">
            {opts.length}
          </span>
        </div>
        <input
          id="pw-length"
          type="range"
          min={MIN_PASSWORD_LENGTH}
          max={MAX_PASSWORD_LENGTH}
          value={opts.length}
          onChange={(e) => setOpts({ ...opts, length: Number(e.target.value) })}
          className="w-full accent-brand-600"
          aria-valuemin={MIN_PASSWORD_LENGTH}
          aria-valuemax={MAX_PASSWORD_LENGTH}
          aria-valuenow={opts.length}
        />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {toggles.map((t) => (
          <Checkbox
            key={t.key}
            id={`pw-${t.key}`}
            label={t.label}
            checked={opts[t.key] as boolean}
            onChange={(v) => setOpts({ ...opts, [t.key]: v })}
          />
        ))}
      </div>

      <div className="flex flex-col gap-2 border-t border-gray-100 pt-3">
        <Checkbox
          id="pw-ambiguous"
          label="Exclude look-alike characters (l, 1, I, O, 0…)"
          checked={opts.excludeAmbiguous}
          onChange={(v) => setOpts({ ...opts, excludeAmbiguous: v })}
        />
        <Checkbox
          id="pw-require"
          label="Include at least one of each selected type"
          checked={opts.requireEachSet}
          onChange={(v) => setOpts({ ...opts, requireEachSet: v })}
        />
      </div>
    </fieldset>
  );
}

// ─── Passphrase controls ─────────────────────────────────────────────────────

function PassphraseControls({
  opts,
  setOpts,
}: {
  opts: PassphraseOptions;
  setOpts: (o: PassphraseOptions) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4">
      <legend className="px-1 text-xs font-semibold uppercase tracking-widest text-gray-400">
        Passphrase options
      </legend>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label htmlFor="pp-words" className="text-sm font-medium text-gray-700">
            Number of words
          </label>
          <span className="font-mono text-sm font-semibold text-gray-900" aria-live="polite">
            {opts.words}
          </span>
        </div>
        <input
          id="pp-words"
          type="range"
          min={MIN_PASSPHRASE_WORDS}
          max={MAX_PASSPHRASE_WORDS}
          value={opts.words}
          onChange={(e) => setOpts({ ...opts, words: Number(e.target.value) })}
          className="w-full accent-brand-600"
          aria-valuemin={MIN_PASSPHRASE_WORDS}
          aria-valuemax={MAX_PASSPHRASE_WORDS}
          aria-valuenow={opts.words}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="pp-separator" className="text-sm font-medium text-gray-700">
          Separator
        </label>
        <select
          id="pp-separator"
          value={opts.separator}
          onChange={(e) => setOpts({ ...opts, separator: e.target.value as Separator })}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800"
        >
          {SEPARATORS.map((s) => (
            <option key={s.label} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2 border-t border-gray-100 pt-3">
        <Checkbox
          id="pp-capitalize"
          label="Capitalise each word"
          checked={opts.capitalize}
          onChange={(v) => setOpts({ ...opts, capitalize: v })}
        />
        <Checkbox
          id="pp-number"
          label="Add a number at the end"
          checked={opts.addNumber}
          onChange={(v) => setOpts({ ...opts, addNumber: v })}
        />
      </div>
    </fieldset>
  );
}

// ─── Output ──────────────────────────────────────────────────────────────────

function OutputPanel({
  results,
  allValues,
  error,
  quantity,
  setQuantity,
  onRegenerate,
}: {
  results: { value: string; entropyBits: number }[];
  allValues: string;
  error: string | null;
  quantity: number;
  setQuantity: (n: number) => void;
  onRegenerate: () => void;
}) {
  const first = results[0];

  return (
    <div className="flex flex-col gap-4">
      {/* Primary result + strength */}
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <div
          className="min-h-[3rem] break-all rounded-lg bg-gray-50 px-4 py-3 font-mono text-lg text-gray-900"
          aria-live="polite"
          aria-atomic="true"
          aria-label="Generated password"
          data-testid="pw-output"
        >
          {error ? <span className="text-sm text-red-600">{error}</span> : first?.value || "—"}
        </div>

        {first && !error && <StrengthMeter entropyBits={first.entropyBits} />}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onRegenerate}
            className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            ↻ Regenerate
          </button>
          <CopyButton value={first?.value ?? ""} disabled={!first || !!error} label="Copy" />
          {results.length > 1 && (
            <CopyButton value={allValues} label={`Copy all ${results.length}`} />
          )}
        </div>
      </div>

      {/* Quantity */}
      <div className="flex items-center gap-3">
        <label htmlFor="pw-quantity" className="text-sm font-medium text-gray-700">
          Generate
        </label>
        <select
          id="pw-quantity"
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-800"
        >
          {QUANTITIES.map((q) => (
            <option key={q} value={q}>
              {q === 1 ? "1 password" : `${q} passwords`}
            </option>
          ))}
        </select>
      </div>

      {/* Bulk list */}
      {results.length > 1 && !error && (
        <ul className="flex flex-col gap-2" aria-label="Generated passwords">
          {results.map((r, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2"
            >
              <span className="min-w-0 flex-1 break-all font-mono text-sm text-gray-800">
                {r.value}
              </span>
              <CopyButton value={r.value} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StrengthMeter({ entropyBits }: { entropyBits: number }) {
  const strength = strengthFromEntropy(entropyBits);
  const style = STRENGTH_STYLES[strength.score];
  const pct = ((strength.score + 1) / 5) * 100;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className={`font-semibold ${style.text}`}>{strength.label}</span>
        <span className="font-mono text-gray-500">{Math.round(entropyBits)} bits of entropy</span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-gray-200"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={strength.score}
        aria-label={`Password strength: ${strength.label}`}
      >
        <div
          className={`h-full rounded-full transition-all ${style.bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-gray-500">
        Est. time to crack offline:{" "}
        <span className="font-medium">{crackTimeText(entropyBits)}</span>
      </p>
    </div>
  );
}

// ─── Reusable checkbox ───────────────────────────────────────────────────────

function Checkbox({
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
