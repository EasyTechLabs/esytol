# EXECUTION-001 — Income Tax Engine

```
── Sprint Declaration (STRATEGY-004/005/006) ─────────
Platform:             Esytol / EasyTechLabs
Domain:               Finance
Category:             calculator (engine hardening — no new tool)
Tool(s):              income-tax (lib/incomeTax.ts)
Priority Score:       ~86 / 100 (Build tier)
Admission Result:     ADMIT (existing engine; gates already passed)
Capital Allocation:   Revenue portfolio · the quarter's #1 funded position (Stage A) ·
                      opportunity cost: three more Authority calculators, declined
Dependencies:         RESEARCH-001, STRATEGY-004/005/006, the frozen Tool Framework
Expected Maintenance: yearly (Finance Act) — a first-charge maintenance item
Platform Impact:      Hardens the highest-value Revenue engine toward its API/enterprise
                      surfaces. Execution PLANNING only — no code this sprint.
──────────────────────────────────────────────────────
```

> **Status:** Execution plan · the flagship engine's hardening programme.
> **Type:** Execution planning. **No implementation, no governance, no new features** — only the plan to make the Income Tax Engine the strongest in the company, in the right order.
> **Last Updated:** 2026-07-18
> **Owner (document):** Income Tax Engine (this programme)
> **Related:** [IncomeTaxMaturityModel](IncomeTaxMaturityModel.md) · [IncomeTaxRoadmap](IncomeTaxRoadmap.md) · [IncomeTaxBusinessCase](IncomeTaxBusinessCase.md) · [IncomeTaxEnterpriseReadiness](IncomeTaxEnterpriseReadiness.md) · [IncomeTaxLaunchChecklist](IncomeTaxLaunchChecklist.md)

---

## Why this engine, why now

The governance system — not enthusiasm — selected this engine. It is the company's
highest-scoring **Revenue** position (Business Score ≈ 86), the STRATEGY-003 "computation
layer" thesis in its purest form (Indian tax is hard, changes yearly, and must be exactly
right), and the company is in **Stage A (Pre-Revenue)** where 55% of capital goes to Revenue.
The market evidence (see [Business Case](IncomeTaxBusinessCase.md)) confirms a real, current
gap: the incumbent income-tax API on RapidAPI is deprecated, and the remaining players sell
heavy full-compliance suites — leaving the lightweight, developer-friendly **calculation** API
under-served. This is the shortest evidenced path to the first payment.

The goal is not more features. It is to move this engine from a **correct calculator** to an
**enterprise-grade computation engine** that can be sold as an API, embedded white-label, and
cited by AI — in a deliberate order.

## PART 1 — Audit of the current engine

Audited against `lib/incomeTax.ts` (353 lines) and `tests/lib/incomeTax.test.ts` (27 cases
incl. 1,000 randomised scenarios) on 2026-07-18.

### What is already strong (do not touch)

- **Correct for its scope:** both regimes (New §115BAC default, Old), §87A rebate with
  new-regime marginal relief, surcharge with recursive marginal relief across all four bands,
  4% cess, slab-wise breakdown. Pure, deterministic, O(slabs).
- **Well-tested for its scope:** 27 cases + 1,000 randomised property scenarios; reference
  values (₹12.75L→NIL, ₹13L→₹26k marginal relief, ₹20L→₹1,92,400).
- **Honest by construction:** documented rounding, sourced to ITD/CBDT/Finance Act 2025,
  Old-vs-New comparison with `recommended` + `taxSaved`, CSV export.

### Findings, categorised by the mission's ten dimensions

| #   | Dimension                 | Finding                                                                                                                                                                                                            | Severity                                                   |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| A1  | **Correctness**           | **Hardcoded to FY 2025-26.** Slabs/rebate/caps are module constants for _one_ year; no `assessmentYear` parameter. Cannot compute AY 2024-25 or 2026-27.                                                           | 🔴 High (blocks API/enterprise)                            |
| A2  | **Correctness**           | **Individual < 60 only.** No senior (60–80, ₹3L exemption) / super-senior (80+, ₹5L) slabs; no HUF/other statuses.                                                                                                 | 🟠 Medium                                                  |
| A3  | **Correctness**           | **No special-rate income.** `otherIncome` is slab-taxed; STCG (15/20%), LTCG (12.5/10%), and 30% VDA are not modelled. Wrong for capital-gains inputs.                                                             | 🟠 Medium (scope limit, must be _declared_ if unsupported) |
| A4  | **Correctness**           | **§288B rounding not applied.** Engine rounds to the nearest ₹1; statute rounds taxable income and tax to the nearest ₹10. Small, systematic deviation.                                                            | 🟡 Low                                                     |
| A5  | **Trust**                 | Sources cited at document level, **not section level** (§115BAC, §87A, §288B, First Schedule surcharge). Reviewer is a generic "Finance Team," not a named professional.                                           | 🟠 Medium (E-E-A-T + enterprise)                           |
| A6  | **Trust**                 | Tests are internally derived, **not tied to ITD's own worked examples**. No published golden vectors.                                                                                                              | 🟠 Medium                                                  |
| A7  | **Performance**           | None material. Pure, bounded, fast. Recursive surcharge relief is bounded (terminates at ₹50L).                                                                                                                    | 🟢 None                                                    |
| A8  | **Maintainability**       | **Year rules are code, not versioned data.** Supporting multiple years requires editing constants each year with no ruleset history — the opposite of what an API needs.                                           | 🔴 High                                                    |
| A9  | **API readiness**         | **No API surface, no request/response contract, no OpenAPI spec, no untrusted-input hardening, no error envelope.** The engine is a pure function; there is no callable, versioned, documented endpoint.           | 🔴 High (the Revenue path)                                 |
| A10 | **Revenue readiness**     | Website-only. The Revenue-Matrix API/white-label/licensing paths are all _Planned, none Live_. No pricing, no metering surface.                                                                                    | 🔴 High                                                    |
| A11 | **Enterprise readiness**  | **No engine versioning (semver), no computation audit stamp** ("computed with ruleset AY-2025-26, engine vX"), no changelog of rule changes, no compliance mapping doc. Results are not reproducibly attributable. | 🔴 High                                                    |
| A12 | **White-label readiness** | Input model is UI-shaped (`annualSalary`, `section80C`…), coupled to `formatINR` from `lib/emi`. No clean, embeddable domain contract.                                                                             | 🟠 Medium                                                  |
| A13 | **AI-search readiness**   | Slab rows exist, but there is **no machine-readable, cited computation trace** (step → statute → amount) for AI to cite, and no MCP/tool-calling surface for an agent to invoke.                                   | 🟠 Medium (GEO + AI-tool path)                             |

### The one-line diagnosis

**A correct, well-tested, single-year, individual-under-60 web calculator — with no
year-versioning, no API contract, and no enterprise audit trail.** Every finding above is a
step on the path from that to a flagship engine; the [Maturity Model](IncomeTaxMaturityModel.md)
organises them into levels and the [Roadmap](IncomeTaxRoadmap.md) sequences them by return.

## This programme's deliverables

| Doc                                                             | Covers                                                                               |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **EXECUTION-001** (this)                                        | The audit (Part 1) and the programme overview                                        |
| [IncomeTaxMaturityModel](IncomeTaxMaturityModel.md)             | The four maturity levels (Part 2)                                                    |
| [IncomeTaxRoadmap](IncomeTaxRoadmap.md)                         | Prioritised tasks with KPIs, risk, dependencies, value (Parts 3–4)                   |
| [IncomeTaxBusinessCase](IncomeTaxBusinessCase.md)               | API-ready architecture (Part 5) + AI readiness (Part 7) + the evidenced revenue case |
| [IncomeTaxEnterpriseReadiness](IncomeTaxEnterpriseReadiness.md) | Compliance, docs, versioning, testing, contracts, change management (Part 6)         |
| [IncomeTaxLaunchChecklist](IncomeTaxLaunchChecklist.md)         | Documentation, examples, validation, acceptance, ops (Part 8)                        |

Nothing here is built this sprint. This is the plan that makes the next builds the _right_
builds, in the _right_ order.
