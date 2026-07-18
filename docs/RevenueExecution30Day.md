# 30-Day Revenue Execution Plan

> **Purpose:** Part 7 of [Revenue Sprint-001](RevenueSprint001.md). The week-by-week plan to convert
> the first paying customer for the Income Tax API. **Every week ends in a measurable _business_
> outcome — never "documentation complete."**
> **Status:** Ready to run · Day 0 = the day the RapidAPI listing goes live.
> **Last Updated:** 2026-07-18
> **Related:** [Revenue Sprint-001](RevenueSprint001.md) · [Opportunity Ranking](RevenueOpportunityRanking.md) · [Playbook](FirstCustomerPlaybook.md) · [Weekly Review](WeeklyProductionReview.md) · [Learning Log](LearningLog.md)

---

## Operating principles for the 30 days

- **One engineer, limited capital:** all distribution is **organic** (no paid ads); engineering is
  **~zero** (the product ships as-is — no new features, per the sprint's stop condition).
- **Talk to humans every week.** Interviews are not optional — they are how pricing and demand get
  validated and how the [Learning Log](LearningLog.md) fills.
- **Log everything** in the [Evidence Register](ProductionEvidenceRegister.md); run the
  [Weekly Review](WeeklyProductionReview.md) at each week's end.
- **A week's outcome is a business event, not an artifact.** If a week produces only docs, the week
  failed.

---

## Week 1 — Publish & get the first external request

**Goal:** the product is live on the marketplace and a real outsider has called it.

- Publish the RapidAPI listing from the [DISTRIBUTE-001 artifacts](IncomeTaxApiListing.md): set Base
  URL `https://www.esytol.com/api/v1`, configure the tiers, paste the listing content, run the
  [Launch Checklist](IncomeTaxApiLaunchChecklist.md) §A–D.
- Ship one honest launch post ("I built a free, correct India income-tax calculation API") to 2–3
  developer communities (r/developersIndia, IndieHackers, dev.to) — link to the free tier.
- Publish one filing-season article on the Learn Center: _"Calculate Indian income tax in code — a
  free API (old vs new regime)"_ with a copy-paste example → link to the listing.
- Stand up a lightweight public example-client GitHub gist/repo to lower integration friction.

> **✅ Week-1 outcome (measurable):** the listing is **live** _and_ there is **≥1 external API
> request from someone who is not us** (proof of discovery), logged as `OBS-001`. If zero external
> requests, the bottleneck is diagnosed as **discovery** and Week 2 doubles down on channels — we do
> **not** touch the product.

## Week 2 — First external signup + first customer interview

**Goal:** someone subscribes (free tier is fine) and we talk to a real prospective buyer.

- Post the Product Hunt / Show HN launch (one concentrated discovery burst).
- Direct, _inbound-style_ engagement in payroll/HR-tech/fintech founder & dev communities: share the
  article and API as a helpful resource where the question already exists (answer "how do I compute
  India tax in my app" threads) — content, **not cold sales**.
- Reach out to **warm** developer contacts for **customer-discovery interviews** (not a pitch): "what
  do you use for India tax calc today? would you pay for an API? how much?" (see the
  [Playbook](FirstCustomerPlaybook.md) interview script).

> **✅ Week-2 outcome (measurable):** **≥1 external free signup** (`OBS-NNN`) **and ≥1 completed
> customer interview** with willingness-to-pay notes recorded in the [Learning Log](LearningLog.md)
> (moves assumption **A-Buyer** and starts **A-WTP**/**A-Price**).

## Week 3 — First active integration / trial

**Goal:** a subscriber makes **repeat real calls** — they're actually building on it.

- Follow up with every signup: offer 1:1 help getting to a working integration (concierge onboarding
  — legitimate for the first customers). Remove any friction they hit.
- Turn the sharpest interview finding into a **cheap, high-leverage fix** _if and only if_ it's a
  docs/example/DX gap (allowed: docs), never a new feature.
- Ask an engaged free user the direct question: _"what would make this worth paying for?"_ → this is
  the pricing-validation conversation.

> **✅ Week-3 outcome (measurable):** **≥1 subscriber making repeat calls** (an active integration,
> `OBS-NNN`) **or** a documented, specific reason they stalled (an equally valuable
> demand/DX verdict). Either way, **A-DX** and **A-Value** move in the Learning Log.

## Week 4 — First paying customer (or a decisive verdict)

**Goal:** convert a payment — or return hard evidence that redirects the next sprint.

- Make the upgrade obvious to active users bumping the free ceiling: a personal note pointing to the
  Pro tier and offering to help. (RapidAPI handles the billing — no code.)
- Run the [Monthly Business Review](MonthlyBusinessReview.md): compile the month's evidence and
  decide the next revenue sprint's focus (keep pushing #1, expand to the salary-tax bundle #3, or
  pivot to white-label #4) — **on evidence**.
- Update the [Learning Log](LearningLog.md): mark every assumption now Validated / Invalidated /
  Still-Unknown.

> **✅ Week-4 outcome (measurable):** **the first paying customer** (`OBS-NNN`, the KPI) —
> **OR**, if no payment landed, a **decisive documented verdict**: is API demand _validated but
> discovery-limited_ (→ keep distributing), _invalidated_ (→ pivot to white-label #4), or _unproven,
> needs more time_ (→ extend with a specific reason)? Guessing is the only failure.

---

## The 30-day scoreboard (fill weekly; no invented targets)

| Metric                               | W1  | W2  | W3  | W4  | Source           |
| ------------------------------------ | --- | --- | --- | --- | ---------------- |
| External API requests                |     |     |     |     | Vercel/RapidAPI  |
| External signups (free)              |     |     |     |     | RapidAPI         |
| Active integrations (repeat callers) |     |     |     |     | logs/RapidAPI    |
| Customer interviews done             |     |     |     |     | notes            |
| **Paying customers**                 |     |     |     |     | RapidAPI billing |
| Assumptions resolved (of 11)         |     |     |     |     | Learning Log     |

## What we will NOT do in these 30 days (guardrails)

- ❌ Build new features, new endpoints, or redesign the API (stop condition holds).
- ❌ Spend on paid ads (limited capital) or start outbound enterprise sales.
- ❌ Cut price in a panic if traffic is low — low traffic is a **discovery** problem; fix reach first.
- ❌ End any week on an artifact. Every week ends on a **business event or a verdict.**

## Contingencies (decided in advance, so we don't improvise)

- **Zero external requests after Week 1** → pure discovery problem → concentrate Weeks 2–3 entirely
  on channels (#2–#6 in the distribution ranking); product untouched.
- **Signups but no repeat calls** → onboarding/DX friction → concierge-onboard + fix docs only.
- **Interest but "too niche / I'd build it myself"** → demand signal for the **salary-tax bundle #3**
  or **white-label #4** → feed the Monthly Review, don't force the current SKU.
- **A correctness bug surfaces** → P0 per the [Runbook](IncomeTaxApiRunbook.md); trust is the asset.
