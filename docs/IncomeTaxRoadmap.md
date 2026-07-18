# Income Tax Engine — Execution Roadmap

> **Purpose:** The prioritised task list that climbs the [Maturity Model](IncomeTaxMaturityModel.md), sequenced by return-on-hours toward the first payment. Every task carries its KPIs, risk, dependencies, and value (Parts 3–4). Part of [EXECUTION-001](Execution001IncomeTax.md).
> **Status:** Execution plan · **T1 (year-versioning), T3 (§288B rounding), T4-partial (trace) and the core of T2 (API contract) + T5 (cited trace) + enterprise attribution shipped in engine v2.0.0 (BUILD-001)** — see docs/IncomeTaxChangelog.md. Remaining: T6-T7 (HTTP API surface + RapidAPI listing → first payment), T8-T12.
> **Last Updated:** 2026-07-18

## Sequencing principle

Order by **return, not by tidiness.** The engine reaches the first payment fastest via a
_Level-2-trusted engine behind a minimal Level-3 API_, so anything on that path is funded
first; enterprise polish (Level 4) waits until the engine earns. Effort is in engineer-days
(½-day granularity). Each task maps to an audit finding (`A#`).

## The tasks, in priority order

| #       | Task                                                                                                                                                                                 | Finding | Level | Effort | Unlocks                                              |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- | ----- | ------ | ---------------------------------------------------- |
| **T1**  | **Year-versioned ruleset** — extract slabs/rebate/caps/surcharge into a `TaxYearConfig` keyed by assessment year; add an `assessmentYear` parameter; preserve AY 2024-25/25-26/26-27 | A1, A8  | 2     | 2–3 d  | Everything — an API that does one year is unsellable |
| **T2**  | **Clean domain contract** — a versioned request/response schema decoupled from the UI input model and from `lib/emi`                                                                 | A9, A12 | 2→3   | 1–2 d  | API, white-label, embeddability                      |
| **T3**  | **§288B rounding** — round taxable income and tax to the nearest ₹10 per statute                                                                                                     | A4      | 2     | ½ d    | Output matches the ITD portal exactly (buyer trust)  |
| **T4**  | **Golden reference vectors** — a versioned corpus of ITD worked-example cases; regression-lock per year                                                                              | A6      | 2     | 2 d    | Provable correctness — the product itself            |
| **T5**  | **Cited computation trace** — structured step → statute (§115BAC/§87A/§288B) → amount, machine-readable                                                                              | A5, A13 | 2     | 2–3 d  | AI citation, enterprise trust, explainability        |
| **T6**  | **API surface design + build** — stateless endpoint, request validation for untrusted input, error envelope, **OpenAPI spec**                                                        | A9      | 3     | 3–4 d  | The Revenue path (marketplace listing)               |
| **T7**  | **RapidAPI listing + pricing** — free tier + paid tier, description, examples                                                                                                        | A10     | 3     | 1–2 d  | **← FIRST PAYMENT**                                  |
| **T8**  | **MCP tool surface** — a tool definition so an AI agent can invoke the engine                                                                                                        | A13     | 3     | 1–2 d  | AI-tool revenue path (2025–26 emerging)              |
| **T9**  | **Age/status breadth** — senior (60–80) / super-senior (80+) slabs; declare HUF/others in/out of scope                                                                               | A2      | 3     | 1–2 d  | Coverage of the taxpayer population                  |
| **T10** | **Special-rate income** — STCG/LTCG/VDA at statutory rates, **or** an explicit out-of-scope error (never silent slab-taxing)                                                         | A3      | 3     | 2–3 d  | Correctness breadth; removes a silent-wrong risk     |
| **T11** | **Engine semver + audit stamp + changelog** — `{engineVersion, assessmentYear, rulesetVersion, computedAt}` on every result                                                          | A11     | 4     | 1–2 d  | Enterprise reproducibility                           |
| **T12** | **Compliance mapping doc + named reviewer** — rule → statute table; a credentialed reviewer                                                                                          | A5      | 4     | 1–2 d  | Enterprise + E-E-A-T                                 |

## Phasing (the shortest honest path to the first ₹)

- **Phase 1 — Trusted engine (Level 2):** T1 → T2 → T3 → T4 → T5. _Correctness breadth + provable
  accuracy + a clean contract._ Without this, the API is a liability, not an asset.
- **Phase 2 — Minimal API → first payment (Level 3 core):** T6 → T7 → T8. _The endpoint, the
  listing, the agent surface._ **The first payment is expected at T7.**
- **Phase 3 — Complete platform (Level 3 breadth):** T9 → T10. _Cover the population; kill the
  silent-wrong capital-gains risk._
- **Phase 4 — Enterprise (Level 4):** T11 → T12, then white-label / enterprise contracts.

**Why this order:** T1 is first because _nothing_ sells without multi-year support — a payroll
buyer computes for their employees' assessment year, not ours. T3/T4 precede the listing because
for a _tax_ API, matching the official figure to the rupee **is** the product; a ₹10 rounding
gap or an uncited number destroys the trust the whole business rests on. Breadth (T9/T10) comes
_after_ the first payment because a paying, narrower engine beats a broad, unearning one
(STRATEGY-005). Enterprise (Phase 4) waits until revenue justifies the audit machinery.

## PART 4 — Per-task KPI blocks

Each task declares its Business KPI, Engineering KPI, Strategic KPI, Risk, Dependencies, and
Expected business value.

### T1 — Year-versioned ruleset

- **Business KPI:** APIs cannot list without it → unblocks 100% of the revenue path.
- **Engineering KPI:** Zero hardcoded year constants outside `TaxYearConfig`; all 1,027 existing
  tests still green against AY 2025-26.
- **Strategic KPI:** Maintenance burden ↓ (a new Finance Act becomes a data file, not a refactor).
- **Risk:** A refactor of the core could regress current answers. _Mitigation:_ golden-vector lock (T4 pattern) on AY 2025-26 before/after.
- **Dependencies:** none (pure refactor).
- **Value:** Converts a one-year calculator into a multi-year engine — the precondition for every revenue surface.

### T2 — Clean domain contract

- **Business KPI:** Enables API + white-label listings (2 Revenue-Matrix surfaces).
- **Engineering KPI:** No dependency from the engine on UI/`lib/emi`; a stable typed contract.
- **Strategic KPI:** Reuse ↑ (the same contract serves website, API, MCP).
- **Risk:** Over-abstraction. _Mitigation:_ design to the two known consumers (API, website), not hypothetical ones.
- **Dependencies:** T1 (year in the contract).
- **Value:** One engine, many surfaces — the STRATEGY-006 reuse compounding.

### T3 — §288B rounding

- **Business KPI:** Output equals the ITD portal to the rupee → removes the #1 buyer objection.
- **Engineering KPI:** Rounding centralised; golden vectors updated.
- **Strategic KPI:** Correctness/trust ↑.
- **Risk:** Changes current displayed figures slightly. _Mitigation:_ documented, versioned, tested.
- **Dependencies:** T1.
- **Value:** Trust is the product for a tax API; this is table stakes.

### T4 — Golden reference vectors

- **Business KPI:** "Verified against the Income Tax Department's own examples" is the listing's headline claim.
- **Engineering KPI:** A per-year corpus; CI fails if any past year's answer changes.
- **Strategic KPI:** Enterprise/contract readiness ↑ (backward-compatibility guarantee).
- **Risk:** Sourcing official examples takes research time. _Mitigation:_ RESEARCH-001 methodology, T1 evidence tier.
- **Dependencies:** T1.
- **Value:** Turns "we think it's correct" into "it is provably correct" — the moat.

### T5 — Cited computation trace

- **Business KPI:** AI-citation + explainability → the GEO and AI-tool paths.
- **Engineering KPI:** A structured trace object (step, statute, input, amount) in the result.
- **Strategic KPI:** AI-search readiness ↑; enterprise auditability ↑.
- **Risk:** Trace drift from the computation. _Mitigation:_ derive the trace from the same code path, not a parallel one.
- **Dependencies:** T1, T3.
- **Value:** Makes the engine quotable by AI and auditable by enterprises simultaneously.

### T6 — API surface design + build

- **Business KPI:** A callable, metered endpoint → the thing a buyer subscribes to.
- **Engineering KPI:** OpenAPI spec; validated untrusted input; stateless; error envelope.
- **Strategic KPI:** Distribution readiness ↑ (marketplace-listable).
- **Risk:** Untrusted-input security. _Mitigation:_ strict schema validation; the engine is pure (no side effects).
- **Dependencies:** T1, T2.
- **Value:** The vehicle for the first payment.

### T7 — RapidAPI listing + pricing

- **Business KPI:** **First payment**; then MRR, paying customers.
- **Engineering KPI:** Listing live; free + paid tiers; examples pass.
- **Strategic KPI:** Revenue-engine coverage 0% → >0% (Portfolio Health indicator #1).
- **Risk:** No buyer discovers it in the window. _Mitigation:_ filing-season timing; the evidenced RapidAPI gap; a value-first community post.
- **Dependencies:** T6, and the Business Case's pricing decision.
- **Value:** Moves the company's single most important number — first payment — off zero.

### T8–T12

Follow the same block pattern in each phase; T8 (MCP) adds the AI-tool path; T9/T10 add coverage
and remove the silent-wrong risk; T11/T12 add the enterprise audit and compliance surfaces.
Their KPIs are recorded when they enter a build sprint's Sprint Declaration.

## Impact estimate (honest, with unknowns)

- **Correctness/trust** (T1,T3,T4,T5): high-confidence internal wins — the engine becomes provably
  correct and multi-year. **Certain.**
- **First payment** (T6,T7): the evidenced shortest path, but the _timing_ of a marketplace buyer
  is **unknown** (RESEARCH-001) — funded as the Stage-A bet, not a guaranteed date.
- **Enterprise/white-label revenue** (T11,T12): **unknown**, unlocked only after the API earns and
  a real integrator appears. Not funded until then.
