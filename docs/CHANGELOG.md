# Esytol — Tool Changelog

> A running log of tools shipped to Esytol, newest first. One entry per tool.
> For sprint-level history see the ProductFactory registry; for finance-engine rule
> changes see `docs/IncomeTaxChangelog.md`.

---

## 2026-07-18 — 🔑 Password Generator (new tool · Security category)

The platform's first interactive **Security** tool and its first globally-targeted
(non-India-specific) utility. Route: `/tools/password-generator`.

- **Cryptographically secure** — randomness from the Web Crypto API
  (`crypto.getRandomValues`) with rejection sampling for zero modulo bias. Never
  `Math.random`.
- **Two modes** — random-character passwords (length 4–128, character-set toggles,
  exclude look-alikes, require one of each type) and **Diceware-style passphrases**
  (3–12 words from a 256-word list, separator, capitalise, add number).
- **Honest strength** — a live strength meter driven by real **entropy (bits)** plus a
  conservative offline **crack-time** estimate that states its attacker assumption.
- **Bulk generate** (1/5/10/20), one-click copy, instant regenerate.
- **Private by design** — 100% client-side; nothing is uploaded, stored, or logged.
- Accessible (labelled controls, `aria-live` output, `progressbar` strength, keyboard-
  operable, strength not colour-only), mobile-responsive, zero-login, and fast (5 kB page,
  no heavy deps).
- Ships the reusable **Security category surface** (domain routing + DeveloperTrust +
  `secureRandomInt`) that the coming `hash-generator` and `uuid-generator` will reuse.

Engine `lib/security/password.ts` (+ `lib/security/wordlist.ts`); UI
`features/tools/password-generator/`. **+33 tests (27 engine + 6 UI)** → 1,563 total.
Docs: `docs/PasswordGenerator.md`.
