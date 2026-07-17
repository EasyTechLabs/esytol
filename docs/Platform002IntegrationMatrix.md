# PLATFORM-002 — Unified Financial Intelligence

> Integration matrix, unified event model, and consistency rules.
> One store (`lib/localFinance.ts`) · one engine (`lib/financialRoadmap.ts`) · no second implementation of anything.

## The one law

Every number a user sees originates in exactly one place:

| Concern                                 | Single source                                                                            | Everyone else               |
| --------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------- |
| Persistence                             | `lib/localFinance.ts` (`esytol.finance.v1`)                                              | readers                     |
| Score / pillars / milestones / timeline | `buildRoadmap()` in `lib/financialRoadmap.ts`                                            | re-render its output        |
| Profile writes                          | Financial Roadmap (whole profile) · `applyEventDelta` (single fields, explicit user tap) | never write                 |
| Calculation history                     | `recordCalculation()` (auto, debounced)                                                  | readers                     |
| Event semantics                         | `lib/financeEvents.ts`                                                                   | emit events, render results |

## Architecture decision: automatic capture, explicit commitment

Calculators recompute live on every keystroke — there is no discrete "calculation
finished" moment, and users explore hypotheticals (three loan scenarios in a row).
Auto-writing exploration into the profile would corrupt it silently, which violates
"no hidden assumptions."

So the platform does both honestly:

- **Automatic:** every stable result is recorded to calculation history (debounced),
  the dashboard's Recent Calculations updates across tabs, and contextual insights +
  next steps render immediately — _reading_ the profile is always automatic.
- **Explicit:** mutating the profile is one visible tap ("Update my plan") that shows
  the exact field, old → new value, and the Health Score impact before and after.
  No profile → no silent creation; the CTA routes to the Financial Roadmap, the
  profile's owner.

## Phase 1 — Integration matrix (18 tools)

| Tool                | Meaningful output              | Event                  | Profile delta (explicit)            | Pillars affected    | Why no delta                                |
| ------------------- | ------------------------------ | ---------------------- | ----------------------------------- | ------------------- | ------------------------------------------- |
| EMI Calculator      | `emi`                          | `LoanCalculated`       | `monthlyEmi`                        | Debt                | —                                           |
| Home Loan           | `summary.monthlyEMI`           | `LoanCalculated`       | `monthlyEmi`                        | Debt                | —                                           |
| Personal Loan       | `summary.monthlyEMI`           | `LoanCalculated`       | `monthlyEmi`                        | Debt                | —                                           |
| SIP                 | monthly investment (input)     | `InvestmentCalculated` | `monthlyInvesting`                  | Savings, Retirement | —                                           |
| RD                  | monthly deposit (input)        | `InvestmentCalculated` | `monthlyInvesting`                  | Savings, Retirement | —                                           |
| Income Tax          | gross annual income (input)    | `TaxCompared`          | `monthlyIncome` (= round(gross/12)) | all ratio pillars   | —                                           |
| FD                  | maturity projection            | `GrowthProjected`      | —                                   | —                   | projection, not a current fact              |
| Lumpsum             | maturity projection            | `GrowthProjected`      | —                                   | —                   | projection                                  |
| PPF                 | maturity projection            | `GrowthProjected`      | —                                   | —                   | projection                                  |
| CAGR                | growth rate                    | `GrowthProjected`      | —                                   | —                   | historical analysis, not position           |
| HRA                 | monthly exemption              | `SalaryCalculated`     | —                                   | —                   | Basic+DA ≠ take-home income                 |
| EPF                 | corpus at retirement           | `RetirementPlanned`    | —                                   | —                   | projection; profile stores _current_ corpus |
| NPS                 | corpus + pension at retirement | `RetirementPlanned`    | —                                   | —                   | projection                                  |
| Gratuity            | payout at exit                 | `RetirementPlanned`    | —                                   | —                   | projection                                  |
| GST                 | tax split                      | — (recency only)       | —                                   | —                   | business tax, no household field            |
| Age                 | age arithmetic                 | — (recency only)       | —                                   | —                   | no financial data                           |
| Financial Roadmap   | whole profile                  | (owner)                | writes entire profile               | all                 | —                                           |
| Financial Dashboard | —                              | (reader)               | never writes                        | —                   | —                                           |

Already stored for every tool (PROJECT-003): recency via `RecentToolTracker`.
New in PLATFORM-002: calculation history with real figures, contextual insights,
explicit profile sync, next-step navigation, progress notifications.

## Phase 2 — Unified event model (`lib/financeEvents.ts`)

```
FinanceEvent =
  | LoanCalculated        { emi, principal, annualRate, months }
  | InvestmentCalculated  { monthlyInvestment, maturityValue, months }
  | TaxCompared           { annualIncome, recommended, totalTax, taxSaved }
  | RetirementPlanned     { projectedCorpus, monthlyPension?, corpusLabel? }
  | GrowthProjected       { invested, maturityValue, months }
  | SalaryCalculated      { exemptAmount, taxableAmount }
```

Each event updates only what it names:

- `describeEvent(event)` → headline figures for calculation history
- `proposeDelta(event, profile)` → the single-field profile change it may make (or null)
- `eventInsights(event, store)` → deterministic insights (engine constants, user's numbers)
- `applyEventDelta(event)` → merge delta → recompute `buildRoadmap` before/after → notifications
- `nextSteps(store, slug)` → the roadmap engine's own `currentAction.links` + dashboard

## Phases 3–6 — propagation, insights, navigation, notifications

```
calculator result (stable ≥800ms)
  → recordCalculation()                        [auto]
  → storage event → dashboard refresh          [auto, cross-tab]
  → eventInsights() rendered under result      [auto]
  → nextSteps() rendered under result          [auto]
user taps "Update my plan"
  → applyEventDelta() merges one field
  → buildRoadmap(before) vs buildRoadmap(after)
  → "✓ Dashboard updated · ✓ Health Score 58 → 54 · ✓ Debt pillar recalculated"
```

Insights only re-word engine arithmetic: EMI ratio vs the 40% ceiling, savings rate
vs the 20% target, emergency months vs the 6-month target, retirement ladder status.
Never LLM reasoning, never products, never projections presented as facts.

## Phase 7 — Consistency rules (enforced by construction + tests)

1. Dashboard, roadmap, insights, and sync notifications all call the same
   `buildRoadmap()` — they cannot disagree.
2. Writers: Financial Roadmap (whole profile), `applyEventDelta` (one field, user
   tap). The dashboard and every insight surface are read-only.
3. No circular updates: writes happen only on user action; `storage` events refresh
   readers only.
4. No stale data: readers re-read on mount and on `storage`.
5. Reset (`clearStore`) erases profile, history, recency, and review state together.
