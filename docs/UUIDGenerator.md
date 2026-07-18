# UUID Generator — Tool Documentation

> **Category:** Security · **Slug:** `uuid-generator` · **Route:** `/tools/uuid-generator`
> **Status:** ✅ Live · **Last Updated:** 2026-07-18
> **Engine:** `lib/security/uuid.ts` (reuses `lib/dev/crypto.ts`) · **UI:** `features/tools/uuid-generator/UuidGenerator.tsx`

The build record for the UUID Generator — the Security category's third tool, completing
the password/hash/UUID cluster.

---

## 1. Problem

Developers need UUIDs constantly — a v4 for a record ID, a v7 for a sortable database key, a
deterministic v5 from a name, or to _validate_ and understand a UUID someone handed them. Many
online generators only do v4, use `Math.random()`, or bury the tool under ads. Esytol needs the
reference implementation: every practical version, bulk output, validation, and honest security.

## 2. Existing reusable code

- **`lib/dev/crypto.ts` → `hashBytes`** (added in TOOL-002) — exactly what v3 (MD5) and v5 (SHA-1)
  need to hash namespace+name. **No hashing is reimplemented.**
- **`lib/dev/files.ts` → `downloadText`** — TXT/CSV export.
- **`features/dev/DevToolLayout`**, **`features/tool/CopyButton`**, **DeveloperTrust**, the
  `security` domain routing (TOOL-001), and the SEO/metadata framework — all reused unchanged.
- The **Web Crypto** pattern and injectable-RNG discipline established by the Password Generator.

## 3. Architecture reuse

No shared lib needed changing — the new logic is a self-contained `lib/security/uuid.ts` that
_imports_ `hashBytes`. The tool is composed entirely from existing platform components; only the
UUID engine and the UI are new. This is the "a new tool = its own transform logic" goal met cleanly.

## 4. Implementation

`lib/security/uuid.ts` — pure, injectable RNG + clock:

- **v4** — 16 secure random bytes (equivalent to `crypto.randomUUID()`).
- **v7** — 48-bit Unix-ms timestamp prefix + random tail (RFC 9562); sorts by time.
- **v1** — time-based with a **privacy-safe random node** (multicast bit set) — never a MAC.
- **v3 / v5** — name-based via MD5 / SHA-1 over namespace+name (reusing `hashBytes`); deterministic.
- **Namespaces** — DNS, URL, OID, X500 (RFC 4122 App. C) + custom-UUID namespace.
- **Inspection** — `isValidUuid`, `inspectUuid` (version + variant + timestamp), `extractTimestamp`,
  recognises Nil and Max UUIDs.
- **Formatting** — `formatUuid` (uppercase / hyphen toggles).

UI (`UuidGenerator.tsx`) — two modes:

- **Generate** — version radios (v1/v3/v4/v5/v7); for random versions a quantity (1/10/50/100/1000)
  - Regenerate; for v3/v5 a namespace select (+ custom) and name input; Copy-all, Download .txt,
    Download .csv, Clear; per-UUID copy; uppercase & hyphen toggles.
- **Validate** — paste a UUID → valid/invalid, version + explanation, variant + explanation, and the
  embedded ISO timestamp for v1/v7.

## 5. Shared improvements

None to shared libs this sprint — `hashBytes`/`downloadText` were already the right shape (a sign the
prior sprints' extensions were well-placed). The reusable UUID logic lives in `lib/security/uuid.ts`
and is available to any future tool (e.g. a v7 database-key helper).

## 6. Tests

- **Engine (`tests/lib/security/uuid.test.ts`, 19):** v4/v7/v1 format + version nibble + variant bits +
  uniqueness + deterministic-under-injected-RNG; **v7/v1 timestamp round-trip**; v7 time-ordering;
  v1 privacy-safe multicast node; **v3/v5 pinned to the authoritative Python `uuid` vectors
  (python.org, DNS)**; namespace sensitivity; `isValidUuid` (canonical/braced/urn/junk);
  `inspectUuid` (version, variant, Nil/Max, timestamp, errors); `formatUuid`; `resolveNamespace`.
- **UI (`tests/features/uuid-generator/UuidGenerator.test.tsx`, 8):** bulk-on-mount; batch-size change;
  version switch reflected; uppercase; hyphen-off; deterministic v5 (python.org vector in the DOM);
  validator explains version + variant; invalid flagged.

## 7. Documentation

This file + the in-app DeveloperTrust surface (how it works, privacy-safe v1, MD5/SHA-1 caveats,
references: RFC 9562, RFC 4122, MDN randomUUID) + a 6-item registry FAQ.

## 8. Registry updates

`uuid-generator` flipped live; **category moved `generator` → `security`** so it joins the Security
cluster; best-in-class description + 12 keywords + 6 FAQs; tags `identifier`/`security` (routes to the
Developer trust surface). `toolStatus` guardrail updated (moved to live).

## 9. ProductFactory updates

Sprint record `Sprints/TOOL-003-UuidGenerator/README.md`; registry row 46; CurrentState (26 live tools,
Security 3); Metrics.

## 10. CHANGELOG updates

New entry in `docs/CHANGELOG.md` (2026-07-18 — UUID Generator).

## 11. Verification / quality checklist

- [x] Production UI, responsive, dark-mode follows platform theme.
- [x] Accessibility: mode `tablist`, version `radiogroup`/`radio`, labelled inputs/selects, output
      list + validator `role="status"`/`alert`, keyboard-operable, status not colour-only (✓/✗ text).
- [x] SEO: metadata, canonical, OpenGraph/Twitter, Schema.org (SoftwareApplication + FAQ + Breadcrumb),
      6-item FAQ, related tools (Password, Hash, Base64, JSON).
- [x] Security: **Web Crypto** everywhere; **never Math.random**; privacy-safe v1 node; input
      validated (custom namespace, paste); output escaped by React; nothing uploaded; honest caveats.
- [x] Reuse: `hashBytes`/`downloadText`/layout/trust/SEO reused; no duplicated logic; no
      TODOs/placeholders/dead code.
- [x] Performance: synchronous v1/v4/v7, async v3/v5; 1000-row list virtually free, scroll-contained;
      no heavy deps.
- [x] i18n-ready; zero-login.
- [x] `format:check` · `lint` · `type-check` · full test suite · `next build` — all green.

## Honest limitations

- v1 uses a privacy-safe random node, not a hardware MAC — spec-permitted, but the node field is not
  machine-tied.
- v3 (MD5) / v5 (SHA-1) are for deriving identifiers, not secure hashing; prefer v5 over v3.
- A UUID is an identifier, not a secret — never use one as a password or token.
- Dark mode follows the platform theme (the site is light-only platform-wide today).
