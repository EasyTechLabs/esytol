# PLATFORM-004 — Everyday Category Foundation

```
── Sprint Declaration (STRATEGY-004) ─────────────────
Platform:             Esytol
Domain:               Everyday
Category:             text (calculator for Age) — format taxonomy
Tool(s):              word-counter, case-converter (new); age-calculator (migrated trust)
Priority Score:       Word Counter ~78, Case Converter ~70 (Part 6)
Admission Result:     ADMIT (Everyday admitted in STRATEGY-004; gates pass)
Dependencies:         DevToolLayout, CopyButton, lib/dev/files, lib/dev/metrics (reused)
Expected Maintenance: static (Unicode/ISO rules rarely change)
Platform Impact:      Adds the Everyday trust surface + reusable Everyday UX; Finance-safe: yes
──────────────────────────────────────────────────────
```

> **Purpose:** Establish Everyday as Esytol's third first-class domain — a permanent foundation so future utilities need only their own logic. No Finance changes, no Developer changes, no forked framework.
> **Status:** Foundation shipped (3 Everyday tools live; Age migrated to the Everyday trust surface)
> **Owner:** Principal Product Architect (EasyTechLabs)
> **Last Updated:** 2026-07-18
> **Related:** Governance/STRATEGY-004-PlatformExpansionFramework.md · docs/Platform003DeveloperCategory.md · docs/DeveloperExperience.md

## The thesis

Esytol now presents **three mature domains** — Finance, Developer, Everyday — on one
platform, each with its own trust surface and the same shared infrastructure. Like
Developer before it, Everyday already existed as a live domain (the Age Calculator),
but it **borrowed the finance trust surface** — a domain-appropriate-trust violation
STRATEGY-004 forbids. This sprint gives Everyday its own foundation and migrates Age
onto it.

## PART 1 — Domain foundation (what shipped)

| Concern                                        | How Everyday plugs in                                                                                                                                  | New code?          |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ |
| Domain definition                              | `registry/domains.ts` Everyday broadened to the general-utility vocabulary; the dormant standalone **Text** domain folded in (STRATEGY-004 merge rule) | Data only          |
| Homepage grid                                  | `getLiveDomains()` returns Everyday (3 live tools) → `DomainSections`                                                                                  | None — automatic   |
| Category landing page                          | `/categories/text` renders via `getLiveCategories()` (word/case are `category: text`)                                                                  | None — automatic   |
| Navigation / `/tools` / breadcrumbs / metadata | Registry-driven                                                                                                                                        | None — automatic   |
| Sitemap                                        | `getLiveTools()` drives `app/sitemap.ts`                                                                                                               | None — automatic   |
| Internal linking                               | `relatedTools` in the registry                                                                                                                         | None — automatic   |
| **Trust surface**                              | Everyday needs its own → **new `EverydayTrust`**                                                                                                       | **Yes (additive)** |

The only genuinely new surface is Everyday's trust model. Everything else activated
automatically — the payoff of the PLATFORM-001 domain design, now proven a third time.

## PART 2 — Everyday trust model

Everyday is neither regulator-cited (Finance) nor RFC-bound (Developer). Its tools are
judged on **objective standards** — Unicode, ISO, calendar rules — and on privacy. The
surface (`content/everydayStandards.ts` + `features/tool/EverydayTrust.tsx`) states, for
every tool:

- **Where it runs** — browser (all V1 Everyday tools are client-side).
- **Data retention** — none; nothing is uploaded, stored, or logged.
- **Privacy** — computed on-device; never leaves the browser.
- **Algorithm explanation** — plain-language "how it works."
- **Standards** — the objective reference (Unicode case mapping, ISO 8601, calendar rules), clickable.
- **Limitations** — the honest caveats (heuristic sentence counts, non-space-segmented scripts, locale case mapping).

It scales to every future Everyday tool by adding one keyed entry — the same pattern as
methodology (Finance) and devStandards (Developer). A test locks that Everyday tools
**never** show finance copy ("not financial advice", "Finance Team").

## PART 3 — Reusable Everyday UX (reuse-first)

Everyday tools are plain text, not code, so they must **not** carry the developer
CodeMirror editor. New, lightweight, non-duplicating components:

- `features/everyday/EverydayInput.tsx` — labelled textarea + shared toolbar
  (sample/paste/upload/copy/clear) + drag-and-drop.
- `features/everyday/EverydayOutput.tsx` — read-only output + copy/download.

**Reused, not duplicated** (Part 5): `DevToolLayout` (a generic controls→input+
validation|output→examples→privacy scaffold — reused directly), `CopyButton`,
`lib/dev/files` (download/copy/paste/upload), `lib/dev/metrics` (character/line/byte
primitives), `ValidationStatus` + `lib/dev/validation` (available when a tool needs
them). No layout, clipboard, download, or validation logic was re-implemented.

## PART 4 — Everyday roadmap (30 candidates)

Every tool client-side, deterministic (generators produce fresh values by design), and
privacy-first. `S`=search opportunity, `M`=maintenance (L=low).

| #   | Tool                      | Purpose                    | Users             | In → Out            | Determinism | Browser? | Maint | S         |
| --- | ------------------------- | -------------------------- | ----------------- | ------------------- | ----------- | -------- | ----- | --------- |
| 1   | **Word Counter** ✅       | Count words/chars/etc.     | Writers, students | text → stats        | yes         | yes      | L     | High      |
| 2   | **Case Converter** ✅     | Convert text case          | Devs, writers     | text → cased        | yes         | yes      | L     | High      |
| 3   | Character Counter         | Live char/limit counter    | Social, SEO       | text → count        | yes         | yes      | L     | High      |
| 4   | Unit Converter            | Length/weight/temp/…       | Everyone          | value+units → value | yes         | yes      | L     | Very high |
| 5   | Time Zone Converter       | Convert times across zones | Remote teams      | time+zones → time   | yes         | yes      | M     | High      |
| 6   | Date Difference           | Days/weeks between dates   | Everyone          | 2 dates → span      | yes         | yes      | L     | High      |
| 7   | Age Calculator ✅         | Exact age                  | Everyone          | DOB → age           | yes         | yes      | L     | High      |
| 8   | QR Generator              | Text/URL → QR image        | Everyone          | text → QR (svg/png) | yes         | yes      | L     | Very high |
| 9   | Password Generator        | Strong random passwords    | Everyone          | rules → password    | fresh       | yes      | L     | Very high |
| 10  | Password Strength Checker | Rate a password locally    | Everyone          | password → score    | yes         | yes      | L     | High      |
| 11  | Color Converter           | HEX ⇄ RGB ⇄ HSL            | Designers         | color ⇄ color       | yes         | yes      | L     | High      |
| 12  | Number to Words           | 12345 → "twelve thousand…" | Finance, forms    | number → words      | yes         | yes      | L     | Med       |
| 13  | Roman Numeral Converter   | Arabic ⇄ Roman             | Students          | number ⇄ roman      | yes         | yes      | L     | Med       |
| 14  | Random Number/Picker      | Ranges, lists, dice        | Everyone          | rules → pick        | fresh       | yes      | L     | Med       |
| 15  | Lorem Ipsum Generator     | Placeholder text           | Designers, devs   | count → text        | yes*        | yes      | L     | High      |
| 16  | Text Diff                 | Compare two texts          | Everyone          | 2 texts → diff      | yes         | yes      | L     | High      |
| 17  | Markdown Preview          | Render Markdown            | Writers, devs     | md → html           | yes         | yes      | M     | High      |
| 18  | Calendar Generator        | Printable month/year       | Everyone          | year → calendar     | yes         | yes      | L     | Med       |
| 19  | Countdown/Timer builder   | Event countdowns           | Everyone          | date → countdown    | yes         | yes      | L     | High      |
| 20  | Slugify                   | Text → URL slug            | Devs, bloggers    | text → slug         | yes         | yes      | L     | Med       |
| 21  | Line Sorter/Dedupe        | Sort/unique lines          | Everyone          | lines → lines       | yes         | yes      | L     | Med       |
| 22  | Find & Replace            | Bulk text replace          | Everyone          | text+rule → text    | yes         | yes      | L     | Med       |
| 23  | Whitespace/Trim cleaner   | Normalise whitespace       | Everyone          | text → text         | yes         | yes      | L     | Med       |
| 24  | Text Repeater             | Repeat text N times        | Everyone          | text+n → text       | yes         | yes      | L     | Low       |
| 25  | Reverse Text              | Reverse chars/words/lines  | Everyone          | text → text         | yes         | yes      | L     | Low       |
| 26  | Binary/Number Base        | Bin/oct/dec/hex convert    | Students, devs    | number ⇄ base       | yes         | yes      | L     | Med       |
| 27  | Barcode Generator         | Text → barcode image       | Retail, ops       | text → barcode      | yes         | yes      | M     | Med       |
| 28  | Percentage Calculator     | Everyday percentages       | Everyone          | numbers → %         | yes         | yes      | L     | High      |
| 29  | Tip / Split Calculator    | Bill splitting             | Everyone          | bill → shares       | yes         | yes      | L     | Med       |
| 30  | Stopwatch / Pomodoro      | Time tracking              | Everyone          | — → timer           | yes         | yes      | L     | Med       |

\* Lorem Ipsum is deterministic given a seed/count; randomised variety is a declared option.

**UUID stays in Developer** (Part 4 asked us to evaluate): UUID Generation/Validation is a
developer primitive (already in the Developer roadmap), so it does **not** move to
Everyday. Password tools _do_ belong in Everyday (general-user need), reusing the shared
crypto where a strength check needs entropy math.

## PART 5 — Shared engines identified (reuse map)

| Need                                       | Reuse                                          | New (Everyday)                                       |
| ------------------------------------------ | ---------------------------------------------- | ---------------------------------------------------- |
| Text transformation                        | —                                              | `lib/everyday/textCase` (case), `textStats` (counts) |
| Character/line/byte metrics                | `lib/dev/metrics`                              | —                                                    |
| Conversion (units/color/base/number-words) | —                                              | `lib/everyday/convert*` (future, per tool)           |
| Encoding                                   | `lib/dev/encode` (Base64/URL/Hex/Unicode/HTML) | —                                                    |
| Random generation                          | `crypto.getRandomValues` (Web Crypto)          | thin `lib/everyday/random` (future)                  |
| Validation                                 | `lib/dev/validation` + `ValidationStatus`      | —                                                    |
| Clipboard                                  | `lib/dev/files` (copy/paste)                   | —                                                    |
| Download / upload                          | `lib/dev/files` (download/readTextFile)        | —                                                    |

The rule: a helper needed by two domains lives in the shared layer and is imported, never
copied. `lib/dev/*` are genuinely generic (files, metrics, encode, validation) and are
reused by Everyday as-is.

## PART 6 — Top-5 implementation plan (justified via STRATEGY-004)

Ranked by the STRATEGY-004 prioritization factors (search, evergreen, reuse, platform
impact, maintenance):

| Rank | Tool                   | Search    | Evergreen | Reuse                    | Impact                                      | Maint | Why                                                  |
| ---- | ---------------------- | --------- | --------- | ------------------------ | ------------------------------------------- | ----- | ---------------------------------------------------- |
| 1    | **Word Counter** ✅    | Very high | Yes       | High (metrics)           | Proves the text engine + Everyday trust     | Low   | The archetypal everyday utility; shipped this sprint |
| 2    | **Case Converter** ✅  | High      | Yes       | High (text engine)       | Proves a second text tool on the foundation | Low   | Shipped this sprint                                  |
| 3    | **Unit Converter**     | Very high | Yes       | Med (new convert engine) | Highest-volume Everyday query class         | Low   | Next — biggest search prize                          |
| 4    | **QR Generator**       | Very high | Yes       | Med (svg, client)        | Broad top-of-funnel; shareable              | Low   | Next                                                 |
| 5    | **Password Generator** | Very high | Yes       | High (Web Crypto)        | Reuses crypto; universal need               | Low   | Next                                                 |

Ranks 1–2 shipped (enough to make Everyday a real, browsable domain of 3 tools and prove
the trust surface + reusable UX). Ranks 3–5 are the next sprint.

## PART 7 — Platform fit (verified)

- **No duplicated infrastructure** — reused DevToolLayout, CopyButton, files, metrics,
  validation; added only Everyday-specific trust data, trust component, and two thin
  text panels.
- **No duplicated trust surface** — EverydayTrust is a _sibling_ to CalculatorTrust and
  DeveloperTrust, not a copy; each domain routes to exactly one.
- **No duplicated registry / layouts / documentation** — one registry, one layout
  scaffold, one docs system.
- **No Finance changes** — finance tools still render CalculatorTrust; the gating stays
  `category === "calculator"` and merely excludes Everyday-domain calculators (no finance
  tool is ever in the Everyday domain). Locked by tests.
- **No Developer changes** — DeveloperTrust and the DX layer are untouched; Everyday
  reuses the generic DevToolLayout without modifying it.

## Result

Esytol now clearly presents **three mature platform domains — Finance, Developer,
Everyday — one platform, three trust surfaces.** Future Everyday tools require only their
unique business logic; the domain foundation (trust model, reusable UX, taxonomy) already
exists.
