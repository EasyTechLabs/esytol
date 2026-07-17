# PLATFORM-003 — Developer Category Foundation

> **Purpose:** Establish "Developer" as Esytol's second first-class category on the same shared platform — no forked architecture, no duplicated framework, Finance untouched.
> **Status:** Foundation shipped (3 reference tools live)
> **Owner:** Principal Product Architect (EasyTechLabs)
> **Last Updated:** 2026-07-18
> **Related:** [registry/domains.ts](../registry/domains.ts) · [Platform002IntegrationMatrix](Platform002IntegrationMatrix.md) · [Growth003FirstThousandUsers](Growth003FirstThousandUsers.md)

## The thesis

Esytol was architected for this in PLATFORM-001. The taxonomy already separates two
concerns, and that separation is exactly what lets a second category slot in without
a rewrite:

- **`Tool.category`** — a _format_ taxonomy (`calculator`, `formatter`, `encoder`,
  `generator`, `security`…). It also gates the finance E-E-A-T trust surface
  (`category === "calculator"` → methodology, regulator sources, reviewer, disclaimer).
- **Domains** (`registry/domains.ts`) — how a _visitor_ browses (Finance / Everyday /
  Developer). Derived from tags, never a second migration, and a domain with no live
  tools never appears on the homepage.

The `developer` domain was defined and dormant. This sprint made it real by shipping
live tools that carry its tags — and the homepage grid, `/tools`, sitemap, category
pages, breadcrumbs and metadata all activated automatically. That is the whole point
of the PLATFORM-001 design: **future categories without another redesign.**

## PART 1 — Category architecture (what shipped)

| Concern                | How Developer plugs in                                                                  | New code?          |
| ---------------------- | --------------------------------------------------------------------------------------- | ------------------ |
| Homepage grid          | `getLiveDomains()` now returns Developer (has live tools) → `DomainSections` renders it | None — automatic   |
| Navigation / `/tools`  | Registry-driven listing already includes all live tools                                 | None               |
| Category landing page  | `/categories/developer` + `/categories/encoder` render via `getLiveCategories()`        | None — automatic   |
| Breadcrumbs / metadata | `buildToolMetadata` + `BreadcrumbList` schema per tool                                  | None — automatic   |
| Sitemap                | `getLiveTools()` drives `app/sitemap.ts`                                                | None — automatic   |
| Iconography            | `⚙️` (domain) + per-tool icons already in the registry                                  | None               |
| Registry integration   | Promoted 3 coming-soon entries to live (removed `status`)                               | Data only          |
| **Trust surface**      | Dev tools must NOT get finance methodology → **new `DeveloperTrust`**                   | **Yes (additive)** |
| **DX**                 | Shared `CopyButton` + `downloadText` for the whole category                             | **Yes (shared)**   |

The only genuinely new surface is the **developer trust surface** — because a JSON
formatter should not claim to be "reviewed by the Finance Team" or carry a "not
financial advice" disclaimer. Everything else is reuse.

### The trust surface — parallel, not forked

`content/devStandards.ts` is the developer analogue of `content/methodology.ts`
(same shape: keyed by slug, a `getDevStandard(slug)` accessor). `DeveloperTrust` is
the analogue of `CalculatorTrust`. `ToolLayout` gained exactly **one additive
branch**:

```
const isCalculator = tool.category === "calculator";        // Finance — unchanged
const isDeveloper  = domainForTool(tool)?.slug === "developer";
...
{isCalculator && <CalculatorTrust tool={tool} />}           // untouched
{isDeveloper  && <DeveloperTrust  tool={tool} />}           // new, additive
```

The developer surface states (Part 5): **where it runs** (browser), **data
retention** (none), **how it works**, **limitations**, and **standards/RFC
references** (clickable — RFC 8259/4648/3986, ECMA-404, WHATWG URL). No finance copy
ever appears on a dev tool; a test locks this.

## PART 2 — Developer tool roadmap (~20)

Every tool is client-side, deterministic (same input → same output; generators
produce fresh values by design), and privacy-first (nothing leaves the browser).

| Tool                        | Category  | Purpose                                      | Target user  | Inputs → Outputs         | Privacy | Determinism    |
| --------------------------- | --------- | -------------------------------------------- | ------------ | ------------------------ | ------- | -------------- |
| **JSON Formatter** ✅       | formatter | Format/validate/minify JSON                  | Any dev      | JSON → pretty/min/sorted | client  | deterministic  |
| JSON Validator              | formatter | Strict RFC 8259 validation w/ error location | Any dev      | JSON → valid? + error    | client  | deterministic  |
| JSON Compare                | formatter | Structural diff of two JSON docs             | API/backend  | 2 JSON → diff            | client  | deterministic  |
| **Base64 Encode/Decode** ✅ | encoder   | UTF-8-safe Base64 both ways                  | Any dev      | text ⇄ base64            | client  | deterministic  |
| **URL Encode/Decode** ✅    | encoder   | Percent-encode component/full                | Web dev      | text ⇄ %-encoded         | client  | deterministic  |
| JWT Decoder                 | security  | Decode header/payload, show claims/exp       | Auth/API     | JWT → header+payload     | client  | deterministic  |
| JWT Generator               | security  | Build a signed JWT (HS256) locally           | Auth/testing | claims+secret → JWT      | client  | deterministic  |
| JWT Inspector               | security  | Validate signature + expiry, explain claims  | Auth         | JWT+secret → verdict     | client  | deterministic  |
| UUID Generator              | generator | v4 (and v1/v7) UUIDs, bulk                   | Any dev      | count → UUIDs            | client  | fresh (crypto) |
| UUID Validator              | generator | Validate + identify UUID version             | Any dev      | string → valid?/version  | client  | deterministic  |
| Hash Generator              | security  | MD5/SHA-1/SHA-256/SHA-512                    | Security/dev | text → digests           | client  | deterministic  |
| Regex Tester                | developer | Test a regex against input, live matches     | Any dev      | pattern+text → matches   | client  | deterministic  |
| Cron Expression Builder     | developer | Human-readable cron + next runs              | DevOps       | cron → schedule          | client  | deterministic  |
| Unix Timestamp Converter    | converter | Epoch ⇄ ISO/local, timezones                 | Any dev      | ts ⇄ date                | client  | deterministic  |
| Diff Checker                | developer | Line/word diff of two texts                  | Any dev      | 2 texts → diff           | client  | deterministic  |
| SQL Formatter               | formatter | Beautify SQL, dialect-aware                  | Backend/data | SQL → formatted          | client  | deterministic  |
| HTML Entity Encode/Decode   | encoder   | `&amp;` ⇄ `&`                                | Web dev      | text ⇄ entities          | client  | deterministic  |
| Color Converter             | color     | HEX ⇄ RGB ⇄ HSL                              | Front-end    | color ⇄ color            | client  | deterministic  |
| Case Converter              | text      | camel/snake/kebab/Title                      | Any dev      | text → cased             | client  | deterministic  |
| API Request Builder         | developer | Compose a request, generate curl/fetch       | API dev      | fields → curl/fetch      | client  | deterministic  |

✅ = live after this sprint.

## PART 3 — Shared-platform integration (what was reused vs added)

**Reused unchanged:** the registry (`toolRegistry`, `getLiveTools`, `getToolBySlug`),
the domain system, `getLiveCategories`, `ToolLayout`, `ToolMetadata`, breadcrumbs,
FAQ rendering (`FAQSection`) + `FAQPage` JSON-LD, `SoftwareApplication` schema,
dynamic OG images (`/og/{slug}`), sitemap, `LIVE_SLUGS`, search, analytics hooks,
`ToolSidebar`/`RelatedTools`.

**Added (additive/shared, never a fork):**

- `content/devStandards.ts` + `getDevStandard` — developer trust data (parallels methodology).
- `features/tool/DeveloperTrust.tsx` — developer trust surface (parallels CalculatorTrust).
- `features/tool/CopyButton.tsx` (+ `downloadText`) — shared category-wide DX helper.
- `lib/dev/{jsonFormat,base64,urlCodec}.ts` — pure engines (the per-tool `lib/` layer, exactly like finance).
- One additive `ToolLayout` branch; two evolved invariant tests (see below).

**Dashboard architecture:** intentionally **not** applied to developer tools. The
shared finance store (`lib/localFinance`) models a household's financial position;
dev tools are stateless transforms with nothing to persist. Forcing them into that
store would be duplication-by-misuse. Recency tracking (RecentToolTracker) still
applies to every tool for free.

## PART 4 — Developer experience standards (category-wide)

1. **Client-side always** — every V1 tool is a pure browser transform; nothing is
   uploaded. Server-side is allowed only when a tool is impossible client-side, and
   must be declared in its trust surface.
2. **Copy buttons** — shared `CopyButton` on every output.
3. **Download outputs** — `downloadText` where a file is the natural artifact (JSON, SQL).
4. **Mono editors, large-input friendly** — resizable `font-mono` textareas; engines
   chunk large inputs (Base64) and never block on the main thread for typical sizes.
5. **Live conversion** — results recompute as you type (`useMemo` over pure engines).
6. **Load-sample / Clear** — every tool offers an example and a reset.
7. **Errors are data, not crashes** — engines return `{ ok, error }`; the UI shows a
   clean message (and location where derivable), never a thrown exception.
8. **Privacy-first messaging** — a "runs in your browser, nothing uploaded" line on
   every tool, echoed in the trust surface.
9. _(Roadmap)_ keyboard shortcuts and drag-and-drop file input where a tool benefits
   (e.g. file → Base64, drop a `.json`). Deferred, not built, to keep V1 honest.

## PART 5 — Trust standards (every developer tool must state)

- **Where it runs:** browser or server (all V1 = browser).
- **Data retention:** for client tools, "nothing is uploaded, stored, or logged."
- **Browser processing:** the data never leaves the device; close the tab and it is gone.
- **Limitations:** the honest caveats (e.g. "Base64 is encoding, not encryption";
  "strict RFC 8259 — no comments/trailing commas").
- **Standards / RFC references:** clickable, authoritative (RFC-Editor, ECMA, WHATWG).

These are enforced structurally: a tool with no `devStandards` entry renders no trust
surface, and the coverage test requires every live dev tool to declare processing,
references, and limitations.

## PART 6 — Implementation order (first five)

Ranked by engineering effort (low = ship faster), search demand, developer
usefulness, reusability, and platform impact.

| Rank | Tool                                    | Effort  | Demand    | Usefulness | Reuse | Why                                                                          |
| ---- | --------------------------------------- | ------- | --------- | ---------- | ----- | ---------------------------------------------------------------------------- |
| 1    | **JSON Formatter** ✅                   | Low     | Very high | High       | High  | Archetypal dev tool; proves the `formatter` category + the whole foundation. |
| 2    | **Base64 Encode/Decode** ✅             | Low     | Very high | High       | High  | Huge search volume; proves the `encoder` category; round-trip-testable.      |
| 3    | **URL Encode/Decode** ✅                | Low     | High      | High       | High  | Shares the encoder pattern; trivial, robust, high intent.                    |
| 4    | **JWT Decoder**                         | Low–Med | High      | High       | Med   | Proves the `security` category; pure client decode; strong developer pull.   |
| 5    | **Hash Generator (SHA-256/1/512, MD5)** | Med     | High      | High       | Med   | Web Crypto (client); proves cryptographic-primitive tooling; pairs with JWT. |

**Ranks 1–3 shipped in this sprint** — enough to make Developer a real, browsable
category (not a stub) and to prove the foundation end-to-end across two format
categories (`formatter`, `encoder`) and the new trust surface. Ranks 4–5 are the
next sprint.

## Invariants that evolved (and why it's safe)

Two tests asserted "every live tool is a calculator / one live category." That was a
Finance-protection invariant — correct when Finance was the only category. This
sprint scoped the protection to its real intent so Finance stays guarded while a
second category exists:

- `domains.test.ts`: "every **Finance-domain** tool is `category: calculator`" (the
  trust-surface guard), instead of "every tool everywhere."
- `toolStatus.test.ts`: live categories now must include `calculator` **and**
  `developer`/`encoder`.

Finance behaviour, data, URLs, schema and trust surface are byte-for-byte unchanged.

## Result

Esytol now presents as a multi-category tools platform: **Finance** (mature, 18
tools) and **Developer** (founded, 3 live + an 20-tool roadmap) on one shared
foundation. The homepage renders both domains from live data; neither the framework
nor Finance was forked to get there.
