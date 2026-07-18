# Capital Allocation Policy

> **Purpose:** The rules that split every 100 engineering hours across the portfolio. Governed by [STRATEGY-006](Strategy006CapitalAllocation.md).
> **Status:** Mandatory governance artifact
> **Last Updated:** 2026-07-18

## First principle: allocation is stage-dependent

A fixed split (e.g. "40/30/20/10 forever") is management theatre. Established portfolio models
exist — McKinsey's Three Horizons, the 70/20/10 core/adjacent/transformational rule used at
Google and elsewhere — and they are useful, but they assume a company that **already earns**.
EasyTechLabs does not. Allocating a mature 40% to Revenue while the company has **₹0 and zero
live revenue paths** would be under-investing in the one thing that is unproven and existential.

Therefore capital allocation is a **function of the company's stage.** The stage is declared at
the top of every quarterly roadmap, and it sets the split.

## The first charge: maintenance comes off the top

You do not get 100 discretionary hours. Correctness is the product (STRATEGY-003), and existing
engines decay — tax rules change yearly, dependencies drift, Finance Acts are passed.

> **15 of every 100 hours are reserved for Maintenance before any discretionary allocation.**
> Maintenance = keeping _live_ engines correct, deployed, and forge-verified. It is
> non-negotiable and non-transferable. If maintenance runs under 15 in a quarter, the surplus
> returns to the discretionary pool; it is never pre-spent on new work.

That leaves **85 discretionary hours** to allocate by stage.

## The stage table (of the 85 discretionary hours)

| Portfolio        | **Stage A — Pre-Revenue** (now) | Stage B — Post-First-Payment | Stage C — Scaling (Gate 0 open, MRR growing) |
| ---------------- | ------------------------------- | ---------------------------- | -------------------------------------------- |
| **Revenue**      | **55%**                         | 40%                          | 35%                                          |
| **Acquisition**  | 10%                             | 25%                          | 30%                                          |
| **Authority**    | 20%                             | 20%                          | 20%                                          |
| **Platform**     | 10%                             | 10%                          | 10%                                          |
| **Experimental** | 5%                              | 5%                           | 5%                                           |

_(Percentages are of the 85 discretionary hours. On a 100-hour month at Stage A: 15 Maintenance,
~47 Revenue, ~17 Authority, ~8 Acquisition/Platform each, ~4 Experimental.)_

### Why these numbers — the justification (Part 2)

- **Revenue 55% at Stage A.** The binding constraint is not building; it is _proving a paying
  buyer exists_ (REVENUE-001 / MONEY-001). Until the first payment, revenue is both the highest
  return and the highest risk, so it takes the majority of discretionary capital. This is
  deliberately _unbalanced_ — a balanced portfolio is a Stage-C luxury the company has not earned.
- **Revenue falls to 40% → 35% as the company matures.** Once a path is Live, the marginal
  return on more revenue engines declines and feeding the funnel (Acquisition) and deepening the
  moat (Authority) start to compound. This mirrors the mature 40/30/20/10 intuition — _reached
  by earning the right to it,_ not assumed on day one.
- **Acquisition rises 10% → 25% → 30%.** Cheap at Stage A (no point filling a funnel that leads
  nowhere yet); it scales once there is a Live revenue surface to convert into.
- **Authority holds at 20% across all stages.** The moat compounds slowly and continuously;
  starving it is how a trusted platform quietly becomes replaceable. Steady, never zero.
- **Platform capped at 10% always.** Platform is a tax that makes other work cheaper; beyond
  ~10% it becomes gold-plating with no funded consumer. The cap is a hard ceiling, not a target.
- **Experimental fixed at 5%, hard-capped.** Enough to buy optionality (one small probe a
  quarter); little enough that a failed bet cannot sink the quarter. The 5% is a _floor and a
  ceiling_ — the company must always run at least one experiment and never more than the cap.

## Enforceable rules

1. **The stage is declared, not assumed.** Every quarterly roadmap states the current stage and
   the exit criterion to the next (Stage A → B is the **first real payment**; B → C is **Gate 0
   open + demonstrable MRR growth**). No stage advances on optimism.
2. **Maintenance is ring-fenced.** New work never borrows from the 15-hour maintenance reserve.
3. **Platform and Experimental are capped, not floored-and-open.** Platform ≤ 10%; Experimental = 5%.
4. **Allocation is spent on the ranked funded positions,** not spread evenly. Within a portfolio,
   hours go to the highest [Business Score](ProductScorecard.md) position first until its next
   milestone is funded, then the next. Half-funding two positions is forbidden.
5. **Unspent portfolio hours roll to Revenue,** not to whatever is most fun. At Stage A, idle
   capital defaults to the existential priority.
6. **Every allocation records its opportunity cost.** The roadmap names, for each funded
   position, the highest-scoring position it chose _not_ to fund with those hours, and why.
7. **Re-allocation happens quarterly, in the CEO review** — never mid-quarter except to respond
   to a Gate-1 correctness incident (which draws on maintenance, not discretionary capital).

## Worked example — a 100-hour month at Stage A (today)

```
100 hours
 −15  Maintenance (first charge: tax-rule currency, dep updates, forge re-verifies)
 = 85 discretionary
   47  Revenue      → ship the Income-Tax/Salary API to a marketplace (Revenue Matrix: Website→API "Live")
   17  Authority    → deepen finance correctness + Learn depth (moat/citation)
    8  Acquisition  → one high-volume Everyday tool WITH a declared bridge to the finance funnel
    8  Platform     → only what the API launch needs (nothing speculative)
    4  Experimental → time-boxed MCP-server probe with a kill date
```

The opportunity cost recorded for this month: the 47 Revenue hours are chosen over funding
three more Authority calculators, because a proven payment is worth more to the company right
now than a broader-but-still-unearning moat.
