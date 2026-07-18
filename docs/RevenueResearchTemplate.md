# Revenue Research Template

> **Purpose:** Establish, on evidence, that someone will actually pay — before a build is funded. Governed by [RESEARCH-001](Research001MarketResearch.md).
> **Status:** Mandatory research artifact
> **Last Updated:** 2026-07-18

Revenue is a _research finding_, not a hope. This template forces the proposal to show who pays,
why, when, and — critically — **evidence that this payment already happens somewhere.** It feeds
STRATEGY-005's Revenue-path scoring and STRATEGY-006's Revenue portfolio, unchanged.

## The seven revenue questions (each cited)

```
Proposal: <name>   ·   Engine: <lib/…>   ·   Date: <YYYY-MM-DD>

1. Who pays?              — the specific payer (a fintech dev, a payroll SaaS, a CA,
                           a partner). Not "users."                          [evidence · confidence]
2. Why do they pay?      — the value that justifies money (save build+maintain
                           time, correctness they can't guarantee, an API they
                           need now).                                         [evidence · confidence]
3. When do they pay?     — the trigger/timing (a deadline, filing season, a
                           feature they must ship). Timing predicts speed-to-first-₹. [evidence · confidence]
4. Recurring or one-time?— subscription (API/SaaS) vs one-time (licence,
                           template). Recurring is worth more but slower to start. [evidence · confidence]
5. Existing willingness   — do people ALREADY pay for this or a close substitute,
   to pay (WTP)?           and how much? (competitor pricing, marketplace subs).  [T1/T2 · confidence]
6. Alternative paths?    — the other Revenue-Matrix surfaces for this engine, if
                           the primary fails (API→white-label→licensing).     [evidence · confidence]
7. Evidence supporting    — the ≥2 independent sources that a payment is real
   payment                (a competitor charging for it + active marketplace
                           subscribers is strong; "seems valuable" is nothing). [T1/T2 · confidence]
```

## Rules

- **Willingness-to-pay must be evidenced, not assumed.** The strongest evidence is _someone already
  charging money for this and having customers._ A competitor's paid tier with visible adoption is
  the gold standard; "it's obviously worth paying for" is disqualified.
- **Free-elsewhere is a red flag, not a detail.** If the same value is free and good (ChatGPT gives
  it, a free tool does it), WTP is near zero unless a specific paid wedge is proven (correctness,
  India-specificity, API access, SLA). Name the wedge or mark revenue "unknown/low."
- **Loss-leaders declare it here.** If the honest answer to "who pays?" is "no one directly," the
  proposal must name the _monetisable engine it feeds_ (STRATEGY-005 loss-leader rule) — or the
  revenue finding is "none," which flows to the scorecard.
- **Timing is evidence for speed.** A payer with a deadline (filing season, a launch) supports a
  fast first payment; a payer with no urgency does not, regardless of size.

## Required output (rolls up into Research Record field 8)

- The **primary revenue path** (Revenue-Matrix surface) with its payer, price band, and cadence.
- The **WTP evidence** (≥2 sources, ≥1 T1/T2) or an honest "unknown."
- The **first-payment hypothesis:** who pays first, through which channel, triggered by what —
  labelled `[ASSUMPTION]` where it reasons beyond current evidence, with the test to confirm it.

> If this template cannot name a payer with evidenced willingness to pay _and_ the proposal is not
> a declared loss-leader, the revenue finding is "none" — and STRATEGY-005's revenue-first gate
> will reject it. That rejection is the system working.
