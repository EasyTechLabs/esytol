# Income Tax Engine — Enterprise Readiness

> **Purpose:** The design for making the engine something a payroll SaaS, a bank, or a CA-software vendor can depend on under contract — Level 4 of the [Maturity Model](IncomeTaxMaturityModel.md). Part of [EXECUTION-001](Execution001IncomeTax.md).
> **Status:** Execution plan · readiness design only — **no implementation.**
> **Last Updated:** 2026-07-18

Enterprise readiness is not a feature; it is a set of _guarantees_. Each guarantee below is a
promise an integrator can rely on and audit. None is built this sprint — this is the specification.

## 1. Compliance

- **Statutory mapping (rule → source).** A maintained table binding every computation rule to its
  legal source: New-regime slabs → §115BAC & First Schedule; rebate → §87A; surcharge → First
  Schedule Part I; cess → the Finance Act; rounding → §288B. An integrator (or a regulator) can
  trace any figure to the law.
- **Named, credentialed review.** The generic "Finance Team" reviewer is replaced by a named tax
  professional who signs off each year's ruleset — E-E-A-T for search, accountability for enterprise.
- **Scope statement.** An explicit, published list of what the engine _does_ and _does not_ compute
  (e.g. "individual residents; senior/super-senior; excludes NRI-specific provisions in vX") — so no
  integrator is silently wrong. An unsupported case returns a clear error, never a guessed number.
- **Privacy/compliance posture.** Stateless, no PII stored, no user content retained — stated in the
  contract so a buyer's own compliance review passes quickly.

## 2. Documentation

- **API reference** (from the OpenAPI spec): every field, type, unit, and error code.
- **Methodology document:** how each figure is computed, with the statutory mapping.
- **Integration guide:** authentication (via the marketplace), request/response examples, error
  handling, and the versioning policy.
- **Changelog:** every ruleset and engine change, dated, with the Finance Act reference.

## 3. Versioning

- **Two independent version axes:**
  - **`assessmentYear`** — _which year's law_ to apply (a request parameter). The engine holds a
    versioned ruleset per year; a past year's answer is immutable.
  - **Engine semver (`MAJOR.MINOR.PATCH`)** — _the software_. MAJOR = a breaking contract change;
    MINOR = a new supported year or additive field; PATCH = a corrected computation (with a migration
    note if any figure changes).
- **Immutability guarantee:** once an `assessmentYear` ruleset is published, its outputs do not change
  except via an explicit, changelogged PATCH — protected by the golden-vector regression tests.

## 4. Testing

- **Golden reference vectors** per supported year, sourced from ITD worked examples (T4).
- **Backward-compatibility tests:** CI fails if any published year's answer changes without a
  changelogged, version-bumped reason.
- **Property tests:** the existing 1,000-scenario randomised suite, extended per year (monotonicity:
  more income → never less tax within a regime; identity: parts reconstruct the total).
- **Contract tests:** the OpenAPI schema and the engine's types cannot drift apart.

## 5. Contracts

- **The API contract** _is_ the SLA surface: a versioned request/response schema, an error taxonomy,
  and a documented determinism guarantee (identical request → identical result, forever, for a fixed
  `assessmentYear` and engine MAJOR).
- **Uptime/latency** are delegated to the marketplace + Vercel; the engine's own guarantee is
  _correctness and determinism_, which is the part only we can provide.
- **Deprecation policy:** a supported year/version is removed only with notice and a documented
  migration path (mirrors STRATEGY-004's deprecation rules — 301s for URLs, changelog for contracts).

## 6. Change management (how a new Finance Act enters safely)

The recurring, first-charge maintenance event. The process:

1. **Trigger:** a Finance Act / CBDT notification changes a rule (the yearly event).
2. **Research:** the change is sourced to the statute (RESEARCH-001, T1 evidence) and dated.
3. **New ruleset, not an edit:** a _new_ `assessmentYear` config is added; existing years are untouched.
4. **Golden vectors:** ITD examples for the new year are added and locked before release.
5. **Review + sign-off:** the named reviewer confirms the mapping.
6. **Version bump + changelog:** engine MINOR (new year) or PATCH (correction), with the Finance Act ref.
7. **Regression gate:** all prior-year golden vectors must still pass — a past answer changing is a
   release blocker, not a footnote.
8. **Deploy + forge-verify:** the only definition of "shipped" (STRATEGY-003).

## The enterprise-readiness scorecard (all must be true for Level 4)

- [ ] Statutory mapping table complete and maintained.
- [ ] Named credentialed reviewer signs each year.
- [ ] `assessmentYear` + engine semver both in force; past answers immutable.
- [ ] Golden vectors + backward-compatibility tests per year.
- [ ] OpenAPI reference + methodology + integration docs published.
- [ ] Change-management process run at least once (a Finance Act ingested through it).
- [ ] Contract determinism guarantee documented; deprecation policy stated.

Until every box is true, the engine is not sold as enterprise-grade — it is sold as exactly what it
is at that moment (a calculator, a trusted engine, or a platform API), honestly.
