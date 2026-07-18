# Income Tax Engine — Changelog

> **Purpose:** The versioned record of every change to the Income Tax Engine's computation and contract. Enterprise integrators depend on this: a past assessment year's answer never changes except via a release logged here. Engine semver: `MAJOR.MINOR.PATCH` (MAJOR = breaking contract; MINOR = new supported year / additive field; PATCH = a corrected computation, with migration notes).
> **Status:** Living
> **Last Updated:** 2026-07-18
> **Related:** `lib/incomeTax.ts` · `lib/incomeTaxApi.ts` · docs/Execution001IncomeTax.md

## API v1 — 2026-07-18 (EXPOSE-001)

The engine gained its first public **HTTP API** — the website is no longer the only consumer.
The computation engine (v2.0.0) is unchanged; this adds a stable surface over it.

### Added

- **`POST /api/v1/income-tax/calculate`** — computes both regimes; returns
  `{ success, apiVersion, engineVersion, assessmentYear, requestId, result }` with the §-level trace
  and attribution. Wraps the tested `lib/incomeTaxApi` contract.
- **Operational endpoints:** `GET /api/v1/health` (liveness), `/api/v1/ready` (readiness — engine
  computes), `/api/v1/version` (versions + supported years), `/api/v1/openapi.json` (OpenAPI 3.1).
- **URL versioning** (`/api/v1`) — future versions coexist.
- **Validation** — malformed JSON → 400; validation failures → 422 with `{code, message, field}`;
  never a stack trace, never an uncaught throw.
- **Observability** — per-request `X-Request-Id`, privacy-safe structured logs (**no income/PII
  logged**), health/ready/version probes.
- **Rate limiting** — configurable sliding-window limiter with a generous public default and
  `X-RateLimit-*` headers (best-effort per-instance on serverless).
- **Authentication abstraction** — `authenticate(req)` with a public default and API-key/bearer
  seams, so auth can be added later without changing routes or the request shape.
- **CORS** — open (`*`) for browser callers.
- **Interactive docs** at `/developers/income-tax-api` (self-contained playground; executable) +
  the machine-readable OpenAPI spec for any Swagger UI / Postman.
- **Developer guide** — `docs/IncomeTaxApiGuide.md` (quick start + curl/JS/Python/Java).

### Notes

- The **engine is untouched** — the API is a thin, stateless adapter over the pure v2.0.0 engine.
- Not in scope (EXPOSE-002+): marketplace listing, billing, API-key issuance.
- Tests: 15 HTTP contract/negative/observability + OpenAPI-structure tests, plus the 45 engine and
  8 contract tests from BUILD-001.

## v2.0.0 — 2026-07-18 (BUILD-001)

The engine graduated from a single-year calculator to a multi-year, provably-attributed,
explainable computation engine. **Backwards compatible:** `calculateIncomeTax(input)` behaves as
before (defaults to AY 2026-27) and every pre-existing test passes unchanged.

### Added

- **Assessment-year versioning.** `calculateIncomeTax(input, { assessmentYear })` selects a
  versioned ruleset. Supported: **AY 2024-25** (FY 2023-24, Finance Act 2023), **AY 2025-26**
  (FY 2024-25, Finance Act 2024), **AY 2026-27** (FY 2025-26, Finance Act 2025; default). Each
  year's rules are held in an immutable `TaxYearConfig`. New exports: `AssessmentYear`,
  `SUPPORTED_ASSESSMENT_YEARS`, `DEFAULT_ASSESSMENT_YEAR`, `isSupportedAssessmentYear`.
- **Enterprise attribution.** Every result carries `attribution: { engineVersion, assessmentYear,
financialYear, rulesetVersion, financeAct, computedAt }`. The core stays **pure**: `computedAt`
  is `null` unless the caller supplies a clock via `{ now }`.
- **Cited computation trace.** Each regime result carries `trace: TraceStep[]` — an ordered
  `{ label, section, amount }` list mapping every step to its statute (§16(ia), §288A, §115BAC,
  §87A, First Schedule surcharge, §288B). Powers explainability, audit, and AI citation.
- **API contract** (`lib/incomeTaxApi.ts`): a versioned, validated boundary — `computeIncomeTax(request)`
  returns a typed `{ ok, apiVersion, result | errors }` envelope, never throws on bad input, and is
  decoupled from the UI model.

### Changed (migration notes)

- **Statutory rounding (§288A/§288B).** Total income and total tax payable are now rounded to the
  **nearest ₹10** (previously ₹1), matching the Income Tax Department portal.
  - **Impact:** a computed total may shift by up to ±₹5 versus v1 for arbitrary incomes. All
    published reference figures (₹1,92,400 · ₹26,000 · ₹70,200 · NIL) are multiples of ₹10 and are
    **unchanged**. The identity `totalTax === roundTo10(taxAfterRebate + surcharge + cess)` now holds
    exactly.
  - **Migration:** integrators comparing to v1 outputs for non-round incomes should expect the ₹10
    granularity; it is the statutorily correct behaviour.

### Unchanged (guarantees)

- The public `IncomeTaxInput` shape and `calculateIncomeTax(input)` call signature.
- All Old/New regime slab math, §87A rebate + marginal relief, surcharge marginal relief, 4% cess.
- Determinism: identical input + assessment year → identical output.
- Privacy: no input is stored or transmitted.

### Tests

- 45 income-tax tests pass (27 pre-existing preserved + 18 new: year-versioning anchors, §288A/B
  rounding, attribution, trace) + 8 API-contract tests. The 1,000-scenario property suite runs on
  the default year with the new rounding identity. Full suite: 1,515 green.

## v1.x — prior to 2026-07-18

Single-year (FY 2025-26 hardcoded), individual < 60, ₹1 rounding, no API contract, no attribution
or trace. See git history before commit `931d87f`.
