# Password Generator — Tool Documentation

> **Category:** Security (the platform's first interactive Security tool) · **Slug:** `password-generator`
> **Status:** ✅ Live · **Route:** `/tools/password-generator` · **Last Updated:** 2026-07-18
> **Engine:** `lib/security/password.ts` (+ `lib/security/wordlist.ts`) · **UI:** `features/tools/password-generator/PasswordGenerator.tsx`

The build record for the Password Generator, covering the tool specification and the
production checklists. Client-side, zero-login, cryptographically secure.

---

## 1. Problem statement

People need strong, unique passwords for every account, but human-chosen passwords are
weak and reused. Existing free generators are often ad-heavy, closed about how they work,
or — worst of all — send the generated password to a server. Esytol needs a fast, honest,
private generator that produces genuinely secure secrets and _shows_ why they're strong.

## 2. Why users search for it

"password generator" is one of the highest-volume evergreen queries on the web. People
search when creating a new account, rotating a breached password, or setting up a password
manager — a recurring, worldwide, non-seasonal need.

## 3. Target audience

Everyone with online accounts (worldwide, non-technical), plus developers and IT/security
staff who need throwaway secrets, seed values, or bulk credentials. Not India-specific —
the platform's first globally-targeted tool.

## 4. SEO keywords

Primary: `password generator`, `strong password generator`, `random password generator`,
`secure password generator`. Secondary: `passphrase generator`, `memorable password
generator`, `diceware generator`, `16 character password generator`, `cryptographically
secure password`. (All carried in the registry entry.)

## 5. Features

- **Two modes:** random characters, and Diceware-style **passphrase**.
- **Password mode:** length 4–128 (slider); toggle lowercase / uppercase / numbers / symbols;
  **exclude look-alike characters** (l/1/I/O/0…); **require at least one of each** selected set.
- **Passphrase mode:** 3–12 words from a 256-word list; separator (hyphen/dot/underscore/space/
  none); capitalise each word; append a number.
- **Live strength meter:** five bands from real **entropy (bits)** + an offline **crack-time**
  estimate that states its attacker assumption.
- **Bulk generate:** 1 / 5 / 10 / 20 at once, each with its own copy button, plus copy-all.
- **One-click copy**, instant regenerate, and a client-side privacy guarantee.

## 6. Edge cases (handled)

- No character type selected → clear error, no blank/crash.
- `require each` with length < number of selected sets → error explaining the minimum.
- Length below 4 / above 128 → rejected by the engine.
- Exclude-ambiguous never empties a set it would otherwise need (numbers keeps 3/4/7/9, etc.).
- Passphrase word count outside 3–12 → error.
- SSR/hydration: the first secret is generated on mount (client-only), never during SSR, so
  `crypto` is always present and there is no hydration mismatch.
- No secure RNG available → the engine throws a clear message rather than silently falling back
  to `Math.random` (it never uses `Math.random`).

## 7. UI wireframe

```
┌───────────────────────────────────────────────┐
│ [ Password | Passphrase ]        ← mode tabs   │
├──────────────────────┬────────────────────────┤
│ OPTIONS              │  ●●●●●●●●●●●●●●●●  (mono)│
│  Length  ───●──  16  │  Very strong · 96 bits  │
│  ☑ lower ☑ upper     │  ▓▓▓▓▓░  crack: 3e6 yrs │
│  ☑ nums  ☑ symbols   │  [↻ Regenerate] [Copy]  │
│  ☐ exclude look-alike│  Generate [1 ▾]         │
│  ☑ one of each type  │  (bulk list when >1)    │
└──────────────────────┴────────────────────────┘
  🔒 Runs entirely in your browser — nothing uploaded.
  [ DeveloperTrust: where it runs · retention · standards ]
```

## 8. API design

None. The tool is 100% client-side by design — sending a password to a server would defeat
its purpose. No network calls are made.

## 9. Database

None. Nothing is stored, logged, or persisted (no localStorage either — a fresh secret each visit).

## 10. Folder structure

```
lib/security/password.ts        — engine (RNG, generators, entropy, strength)
lib/security/wordlist.ts        — 256-word passphrase list
features/tools/password-generator/PasswordGenerator.tsx  — client UI
app/tools/password-generator/page.tsx                    — route + metadata
content/devStandards.ts         — trust surface entry (password-generator)
tests/lib/security/password.test.ts                      — engine tests
tests/features/password-generator/PasswordGenerator.test.tsx — UI tests
```

## 11. Components

`PasswordGenerator` (container) → `PasswordControls`, `PassphraseControls`, `OutputPanel`,
`StrengthMeter`, `Checkbox`. Shared platform pieces: `DevToolLayout`, `CopyButton`,
`ToolLayout` + `DeveloperTrust` (trust surface), `ToolMetadata` (SEO/JSON-LD).

## 12. Utility functions (engine)

`secureRandomInt` (unbiased CSPRNG via rejection sampling), `generatePassword`,
`generatePassphrase`, `strengthFromEntropy`, `crackTimeText`. All pure with an injectable
`RandomInt` for deterministic tests; production uses `crypto.getRandomValues`.

## 13. Test plan

- **Engine (27 tests):** length; pool membership; single-set; exclude-ambiguous; require-each
  guarantee; no-set and length-too-short errors; entropy = length·log2(pool) / words·log2(list);
  deterministic under an injected RNG; RNG in-range, `max=1`, throws on non-positive, ~uniform;
  passphrase word count/separator/capitalise/number; word-list has no duplicates and is a power of
  two; strength bands + monotonic; crack-time buckets.
- **UI (6 tests):** generates on mount (length 16); strength meter + entropy readout; regenerate
  differs; error when no type selected; passphrase mode yields separated words; bulk of 5.

## 14. Documentation

This file + the in-app DeveloperTrust surface (how it works, retention, limitations, standards:
MDN Web Crypto, NIST SP 800-63B, EFF Diceware) + the 7-item registry FAQ.

## 15. Accessibility checklist

- [x] Every control has a real `<label>` / `<legend>`; mode is a `role="tablist"` with `aria-selected`.
- [x] Range sliders expose `aria-valuemin/max/now`; the value is announced (`aria-live`).
- [x] The generated password region is an `aria-live="polite"` labelled region (updates announced).
- [x] Strength bar is a `role="progressbar"` with `aria-valuenow` and an accessible name.
- [x] Fully keyboard-operable (native inputs + buttons); visible focus from platform styles.
- [x] Strength is conveyed by **text + label**, not colour alone (colour-blind safe).

## 16. Performance checklist

- [x] Pure client compute, O(length) / O(words) — imperceptible.
- [x] No external requests, no fonts/images, no heavy deps (uses built-in Web Crypto).
- [x] Engine is a small module; the word list is ~1.5 KB; the page ships no chart/editor libs.
- [x] No layout shift — output region has a reserved min-height.

## 17. Analytics events

Consistent with the platform's honest-analytics posture (Gate 0). The page is tracked as a
standard tool view via the existing `RecentToolTracker`; no keystroke/secret data is ever
collected (a password tool must never observe its output). Suggested future events (only once
Gate 0 opens): `password_generated` (mode only, no value), `password_copied`, `mode_switched`,
`bulk_generated` (count only). **No generated secret is ever sent anywhere.**

## 18. Deployment checklist

- [x] `npm run format:check` · `lint` · `type-check` · `test` · `build` all green.
- [x] Registry entry live (status removed), sitemap includes `/tools/password-generator`.
- [x] Routes/domain/status tests updated (moved to live; Security category surfaces).
- [x] Trust surface (`devStandards`) entry present so DeveloperTrust renders.
- [x] Mobile-responsive (single-column stack), zero-login, no server dependency.

## Reusability note

This ships the **Security** category surface. `hash-generator` and `uuid-generator` (already
registered as coming-soon) reuse the same domain routing, trust surface, `DevToolLayout`,
`CopyButton`, and the `secureRandomInt` primitive — so each is only its own transform logic.

## Honest limitations

- Dark mode follows the platform theme; the site is currently light-themed platform-wide (a
  site-wide theming pass is a separate concern, not this tool's to introduce unilaterally).
- The crack-time figure is a conservative worst-case estimate (100 B guesses/s, weak hash), not a
  guarantee — stated as such in the UI and the trust surface.
- Passphrase strength scales with word count; a 256-word list gives 8 bits/word, so reaching
  "Strong" (60+ bits) needs 8 words. The meter shows this honestly rather than overstating.
