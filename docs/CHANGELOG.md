# Esytol — Tool Changelog

> A running log of tools shipped to Esytol, newest first. One entry per tool.
> For sprint-level history see the ProductFactory registry; for finance-engine rule
> changes see `docs/IncomeTaxChangelog.md`.

---

## 2026-07-18 — 🔏 Hash Generator (new tool · Security category)

The Security category's second tool, and a showcase of platform reuse — the hash
algorithms already lived (tested) in `lib/dev/crypto.ts`, so this sprint added only the
new capability and UI. Route: `/tools/hash-generator`.

- **Three modes** — **Text** (live MD5/SHA-1/SHA-256/SHA-512), **File** (checksums of a
  dropped/selected file's raw bytes), and **HMAC** (keyed hash with a secret, SHA-256/1/512).
- **Checksum verification** — paste an expected hash to confirm a download's integrity; the
  matching digest highlights green with an "authentic" status.
- **Uppercase-hex toggle**, one-click copy per digest.
- **Private by design** — 100% client-side (Web Crypto + pure MD5); text, files, and secrets
  never leave the browser. Honest MD5/SHA-1 "broken for security" warnings.
- **Reuse, not duplication** — extended the shared libs: `hashBytes`/`hashAllBytes` added to
  `lib/dev/crypto.ts` (byte/file hashing; the string API now delegates to them), and
  `readBinaryFile` added to `lib/dev/files.ts`. No algorithm was rewritten.
- Accessible (tablist, labelled inputs, keyboard-operable drop zone, status not colour-only),
  responsive, zero-login, fast.

**+13 tests** (7 crypto vectors incl. an HMAC-SHA256 vector + 6 UI) → 1,576 total.
Docs: `docs/HashGenerator.md`.

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
