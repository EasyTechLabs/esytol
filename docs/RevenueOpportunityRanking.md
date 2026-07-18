# Revenue Opportunity Ranking — Top 10

> **Purpose:** Part 5 of [Revenue Sprint-001](RevenueSprint001.md). Every realistic path to first
> revenue from **existing assets**, ranked. An "opportunity" = _asset × revenue model × distribution
> channel._ Ranked by **probability of a first payment in 30 days at one-engineer effort** — not by
> ceiling revenue.
> **Status:** Ranked · #1 is the recommendation.
> **Last Updated:** 2026-07-18
> **Related:** [Revenue Sprint-001](RevenueSprint001.md) · [30-Day Execution](RevenueExecution30Day.md) · [Playbook](FirstCustomerPlaybook.md)

---

## Ranking axes

- **Time-to-launch** — how fast it can be _live and able to take a payment_.
- **Eng effort** — new engineering required (we have one engineer).
- **Probability** — realistic odds of a _first payment within 30 days_.
- **Risk** — what most likely kills it.
- **Evidence / Confidence** — grounding, graded per RESEARCH-001's framework.

## The top 10

### #1 — Income Tax API × marketplace subscription × RapidAPI + dev-community ⭐ RECOMMENDED

- **Expected customer:** developer at an Indian payroll / HR-tech / fintech / lending / CA-software product.
- **Why they pay:** correct, cited, multi-year tax computation < the cost of building & maintaining it in-house.
- **Revenue model:** subscription + usage tiers (Basic free / Pro $10 / Ultra $29 / Mega $99 — hypothesis).
- **Distribution:** RapidAPI search + filing-season content/SEO + honest developer-community posts.
- **Time-to-launch:** days (listing artifacts ready). **Eng effort:** ~zero.
- **Risk:** narrow buyer pool; marketplace discovery may exceed 30 days.
- **Evidence:** deprecated incumbent + heavy-only competitors [T1]; payroll WTP ₹40–120 PEPM [T2]; in-season. **Confidence: Medium.**

### #2 — Income Tax API × direct one-time / lifetime deal × Product Hunt / IndieHackers

- **Customer:** indie dev / early-stage founder who prefers to pay once.
- **Why they pay:** lifetime access psychology converts fast on launch day.
- **Model:** one-time purchase (own billing).
- **Distribution:** launch burst.
- **Time-to-launch:** +1–2 weeks. **Eng effort:** **Medium** — needs own key-auth + billing (EXPOSE-002).
- **Risk:** engineering we don't need (marketplace already bills); splits focus.
- **Evidence:** launch-deal patterns are common but unproven for us. **Confidence: Low–Medium.**

### #3 — Salary-tax API bundle (Income Tax + HRA + EPF + Gratuity + NPS) × subscription × same dev channel

- **Customer:** the _payroll_ developer specifically (needs the whole salary stack).
- **Why they pay:** one API for all India salary math, not five integrations.
- **Model:** subscription (higher tier).
- **Time-to-launch:** +2–3 weeks (wrap existing engines behind the contract). **Eng effort:** Medium.
- **Risk:** premature breadth before validating the core API's demand.
- **Evidence:** same [T2] payroll signal, stronger fit. **Confidence: Medium** — but **do #1 first**; this is the natural expansion.

### #4 — White-label / embeddable calculators × one-time or licence × advisors, agents, CA firms

- **Customer:** Indian financial advisor / insurance agent / loan DSA / small CA firm.
- **Why they pay:** branded lead-capture calculators on their own site during season.
- **Model:** one-time or annual licence.
- **Time-to-launch:** weeks. **Eng effort:** **High** — embed/licensing product + billing.
- **Risk:** requires **outbound sales** (non-technical buyers won't find a self-serve embed we haven't marketed).
- **Evidence:** strong qualitative demand for branded calculators; unmeasured. **Confidence: Medium** on demand, **Low** on 30-day self-serve. → **Phase-2 pick.**

### #5 — Income Tax Calculator (web) × affiliate × filing-season SEO

- **Customer:** salaried filer → referred to a filing service / insurer.
- **Why _we_ get paid:** affiliate commission on referred conversions.
- **Time-to-launch:** days to add links; **payment** depends on traffic + partner payout cycle.
- **Eng effort:** Low. **Risk:** **needs traffic we can't measure (Gate 0)** + affiliate approval + long payout lag.
- **Evidence:** none on our conversion. **Confidence: Low.**

### #6 — Loan calculators (EMI / Home / Personal) × lender affiliate × SEO

- **Customer:** borrower → lender referral.
- **Model:** referral/affiliate commission.
- **Time-to-launch:** slow (needs lender deals + traffic). **Eng effort:** Medium.
- **Risk:** traffic-dependent + partnership-dependent (borders on outbound). **Confidence: Low.**

### #7 — Financial Roadmap / Dashboard × freemium SaaS × content/SEO

- **Customer:** DIY financial planner.
- **Model:** freemium subscription.
- **Time-to-launch:** weeks–months. **Eng effort:** **High** (own auth + billing + gating).
- **Risk:** highest investment, needs an audience to convert. **Confidence: Low** for 30 days.

### #8 — Income Tax Calculator (web) × display ads × SEO

- **Model:** ad RPM.
- **Time-to-launch:** blocked. **Eng effort:** Low. **Risk:** Gate 0 blind + AdSense approval + needs _large_ traffic; revenue-per-visit tiny. **Confidence: Very Low** for a "first payment."

### #9 — Investment/GST calculators × ads/affiliate × SEO

- Same shape as #5/#8, less seasonal pull. **Confidence: Very Low** near-term.

### #10 — Developer / Everyday tools (JSON, Base64, URL, Age, Word Counter, Case Converter) × any paid model

- **Reality:** commodity utilities with **near-zero willingness-to-pay**; hundreds of free equivalents.
- **Verdict:** **no honest paid model.** Keep free as SEO/top-of-funnel. **Confidence: n/a** — not a revenue path.

## Summary table

| #     | Opportunity                      | Model              | Time-to-launch | Eng effort | Prob. (30-day payment) | Confidence |
| ----- | -------------------------------- | ------------------ | -------------- | ---------- | ---------------------- | ---------- |
| **1** | **Income Tax API × RapidAPI**    | subscription/usage | **days**       | **~zero**  | **Highest available**  | **Medium** |
| 2     | Income Tax API × lifetime deal   | one-time           | +1–2 wk        | Medium     | Medium                 | Low–Med    |
| 3     | Salary-tax API bundle            | subscription       | +2–3 wk        | Medium     | Medium (do #1 first)   | Medium     |
| 4     | White-label calculators          | licence            | weeks          | High       | Low (outbound)         | Med / Low  |
| 5     | Income Tax web × affiliate       | affiliate          | days–slow      | Low        | Low (Gate 0)           | Low        |
| 6     | Loan calcs × affiliate           | affiliate          | slow           | Medium     | Low                    | Low        |
| 7     | Roadmap/Dashboard × SaaS         | freemium           | months         | High       | Very Low               | Low        |
| 8     | Income Tax web × ads             | ads                | blocked        | Low        | Very Low               | Very Low   |
| 9     | Investment calcs × ads/affiliate | ads/affiliate      | slow           | Low        | Very Low               | Very Low   |
| 10    | Dev/Everyday tools × paid        | —                  | —              | —          | none                   | n/a        |

**Conclusion:** #1 dominates on the axis that matters now — _time-to-first-payment at one-engineer
effort with no audience and no outbound._ #3 is its natural next expansion; #4 is the Phase-2 pivot
if #1's demand validates but the marketplace channel underperforms. Everything from #5 down is
traffic-, approval-, or build-gated and cannot realistically produce the _first_ payment in 30 days.
