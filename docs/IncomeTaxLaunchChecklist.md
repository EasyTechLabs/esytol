# Income Tax Engine — Launch Checklist

> **Purpose:** The operational gate that must be green before the Income Tax API is listed for sale — documentation, examples, validation, acceptance criteria, and the operational runbook (Part 8). Part of [EXECUTION-001](Execution001IncomeTax.md).
> **Status:** Execution plan · the checklist to run at launch — **not run this sprint.**
> **Last Updated:** 2026-07-18

"Launch" here means **the API is listed on the marketplace and can take a payment.** Nothing is
launched until every mandatory box below is checked _and_ `forge execution production verify`
passes — a green build and a pushed commit are not a launch (STRATEGY-003).

## 1. Documentation (mandatory)

- [ ] **OpenAPI spec** published and valid; every field has a type, unit, and description.
- [ ] **API reference** rendered (from the spec) with every endpoint, parameter, and error code.
- [ ] **Methodology doc** live on esytol.com: how each figure is computed, with statutory citations.
- [ ] **Integration guide:** auth (via marketplace), request/response examples, error handling, the
      versioning + `assessmentYear` policy.
- [ ] **Changelog** initialised with the launch version and the supported assessment years.
- [ ] **Scope statement** published: what is and is not computed (age/status/special-rate coverage).

## 2. Examples (mandatory)

- [ ] A **runnable request/response** for each core case: salaried < 60 (both regimes), a
      surcharge case (> ₹50L), a marginal-relief case (just over ₹12L new / ₹50L), a senior case
      (once T9 ships), and an out-of-scope case returning a clean error.
- [ ] Each example's expected output **matches the ITD portal to the rupee** (§288B rounding, T3).
- [ ] `curl` + one SDK snippet (e.g. Python/JS) that a buyer can paste and run.

## 3. Validation (mandatory)

- [ ] **Golden reference vectors** pass for every supported `assessmentYear` (T4).
- [ ] **Backward-compatibility tests** pass — no published year's answer has changed.
- [ ] **Property tests** pass (1,000+ randomised scenarios per year; monotonicity + parts-reconstruct-total).
- [ ] **Untrusted-input validation** tested: malformed/hostile input returns a typed error, never a 500.
- [ ] **Contract test** passes: OpenAPI schema and engine types do not drift.
- [ ] Full esytol suite green; production build clean.

## 4. Acceptance criteria (the definition of "ready to sell")

The API is ready to list when **all** hold:

1. **Correctness:** matches the ITD portal to the rupee across the golden-vector corpus.
2. **Multi-year:** at least AY 2024-25, 2025-26, 2026-27 selectable and immutable.
3. **Explainability:** every result carries the cited computation trace (T5).
4. **Statelessness/privacy:** no PII stored; identical request → identical result.
5. **Stability:** a versioned contract with an error taxonomy and a determinism guarantee.
6. **Deployed + forge-verified** in production.
7. **Pricing + free tier** configured on the marketplace (from the [Business Case](IncomeTaxBusinessCase.md)).

If any criterion is unmet, the launch is a _smaller_ honest launch (e.g. "AY 2025-26 only, beta") —
never a claim the engine cannot back.

## 5. Operational checklist (post-launch runbook)

- [ ] **Monitoring:** marketplace analytics watched for the first subscription (Portfolio Health
      indicator #1: Revenue-engine coverage 0% → >0%).
- [ ] **Weekly (Monday):** engineering floor green (tests/forge/build); log any revenue signal into
      [Business KPIs](BusinessKPIs.md); update the Revenue Matrix row (API: Planned → **Live** on
      first payment).
- [ ] **Support path:** a documented channel for integrator questions; response-time expectation set.
- [ ] **Incident response:** a correctness incident (a reported wrong figure) is a P0 that draws on
      the maintenance reserve (STRATEGY-006), fixed via the change-management process, forge-verified,
      changelogged — never hot-patched silently.
- [ ] **Yearly (Finance Act):** run the change-management process (Enterprise Readiness §6) to add the
      new assessment year _before_ filing season, not during it.
- [ ] **Quarterly:** the engine is re-graded in the CEO Review (earning? growing? invest more?).

## The launch verdict

When the acceptance criteria are green and forge-verified, the [Business Case](IncomeTaxBusinessCase.md)
pricing is live, and the operational runbook is staffed, the Income Tax Engine ships as the
company's first **Revenue-Live** engine — the moment the whole governance stack was built to reach.
