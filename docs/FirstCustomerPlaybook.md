# First-Customer Playbook — Income Tax API

> **Purpose:** The tactical field guide for actually landing the first paying customer: who to
> target, where to find them, what to say, how to convert, and how to answer objections. This is the
> "how" behind the [30-Day Plan](RevenueExecution30Day.md).
> **Status:** Ready to run. **Last Updated:** 2026-07-18
> **Related:** [Revenue Sprint-001](RevenueSprint001.md) · [30-Day Execution](RevenueExecution30Day.md) · [Opportunity Ranking](RevenueOpportunityRanking.md) · [Listing](IncomeTaxApiListing.md) · [Pricing](IncomeTaxApiPricing.md) · [Learning Log](LearningLog.md)

---

## 1. Ideal Customer Profile (ICP)

**Primary ICP — "the payroll/fintech builder":**

- A developer or technical founder at an Indian **payroll, HR-tech, fintech, lending, or CA-software**
  product (early-stage to mid-size), or a freelancer building one for a client.
- **Has the job:** must show a correct India income-tax / take-home number inside their product.
- **Pain:** the tax rules change every Finance Act; building and _maintaining_ the logic (regimes,
  slabs, surcharge, cess, §87A, rounding) is recurring work and audit risk they'd rather not own.
- **Buying power:** can expense a $10–29/mo API without procurement.

**Signals someone is in-ICP:** asks "how to calculate income tax in [language]", builds salary/CTC
tools, works on payroll/HRMS, posts about Indian tax compliance, maintains a take-home calculator.

**Explicitly NOT the first customer (yet):** end consumers (they use the free web calculator);
large enterprises (need outbound + procurement); non-technical advisors (that's the white-label
Phase-2 buyer, reached differently).

## 2. Where they are (channels, most-targeted first)

| Channel                                             | What to do there                                                                         | Register-worthy signal |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------- |
| **RapidAPI category search**                        | Be listed, well-described, free tier visible                                             | a subscribe            |
| **r/developersIndia, r/india, r/IndiaTax**          | Answer existing "how do I compute India tax" questions with the API as one honest option | click / signup         |
| **IndieHackers / dev.to / Hashnode**                | A build-in-public post + a technical how-to article                                      | signup                 |
| **Product Hunt / Show HN**                          | A single launch-day burst                                                                | signups spike          |
| **GitHub**                                          | A public example client so devs find working code                                        | stars / forks / calls  |
| **Payroll/HR-tech founder LinkedIn & niche Slacks** | Share the resource where the need is discussed (content, not DMs)                        | reply / interview yes  |

Rule: **be helpful where the question already exists.** No cold DMs, no spam — that is outbound and
it's off the table (and it doesn't work).

## 3. The message (positioning)

**One-liner:** _"A free, correct, developer-priced India income-tax **calculation** API — both
regimes, multi-year, with a cited computation trace. The incumbents sell heavy compliance suites;
this is just the correct number, in code."_

**Lead with these three, in order:** (1) **correct** (verified against ITD examples, cited trace),
(2) **free to start** (no signup friction to the first call), (3) **saves you owning tax code**
(it changes every year; we maintain it). Show, don't tell — every post/article carries a copy-paste
request that returns a real number in one call.

## 4. Customer-discovery interview script (Weeks 2–3)

Goal: **learn**, not pitch. 15 minutes. Ask, then shut up.

1. "Today, how do you compute India income tax / take-home in your product?"
2. "Who built that, and who maintains it when the Finance Act changes?"
3. "What's annoying about that?"
4. "If an API gave you the correct number with the working, would that be useful? Where?"
5. "What would you expect to pay for that — and what would make it a no-brainer vs. not worth it?"
6. (Only if they're keen) "Want a key? I'll help you wire it up."

Log every answer in the [Learning Log](LearningLog.md): Q4→**A-Value**, Q5→**A-WTP/A-Price**,
who-they-are→**A-Buyer**. Three interviews beat any amount of guessing about price.

## 5. The conversion path (free → paid)

```
 discover listing/post → call the free tier (first success) → build a real integration
   → bump the free ceiling (real usage) → personal note offering help + the Pro tier → first payment
```

- **Concierge onboarding is allowed and encouraged** for the first handful: personally help them get
  a green 200 and a working integration. First customers are earned by hand, then systematized.
- **The upgrade moment is real usage, not a nag:** when an active user approaches the free ceiling,
  that's the honest, well-timed moment to point at Pro. RapidAPI handles the billing — we write no
  code.
- **Never** dark-pattern the free tier or fabricate scarcity. Trust is the whole product for a tax API.

## 6. Objection handling

| Objection                     | Honest response                                                                                                                                               |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "I'll just build it myself."  | "Totally can — the rules change every Finance Act though; this is the maintenance you don't re-own each year. Free tier's there if you ever want to skip it." |
| "How do I know it's correct?" | "It's verified against ITD worked examples and every response includes a section-cited trace so you can check the math step by step."                         |
| "Is my data safe?"            | "Incomes are never logged — only request metadata. It's a pure calculation, no storage."                                                                      |
| "Only India?"                 | "Yes — India income tax, done properly, is the whole point. Old + new regime, AY 2024-25 to 2026-27."                                                         |
| "Price seems arbitrary."      | "Honestly, it is a starting hypothesis — you'd be an early user and your feedback sets it. What would feel fair?" (→ pricing evidence)                        |
| "No SDK?"                     | "It's plain JSON/HTTP — here's a copy-paste example that works in one call; happy to help you wire it in."                                                    |

## 7. What "the first customer" teaches us (tie-back to evidence)

The first payment isn't just revenue — it's the event that flips assumptions in the
[Learning Log](LearningLog.md): **A-FirstBuyer** (someone pays), **A-Price** (at which tier),
**A-Buyer** (who they turned out to be), **A-Value** (the job they hired it for). Capture all four
the day it happens, in the [Evidence Register](ProductionEvidenceRegister.md).

## 8. Guardrails (ethical, non-negotiable)

- No cold outbound spam; no fake reviews; no fabricated testimonials or user counts.
- No dark patterns on the free tier or the upgrade.
- Correctness is sacred — a wrong tax number is a P0 incident, not a growth-hack cost.
- Every claim we make (correct, cited, private, in-season) is **true today** — no vaporware.

> **The whole playbook in one line:** be genuinely useful to the exact developer who needs this,
> where they already are, during the season they need it — and let a correct free call plus an honest
> upgrade do the selling.
