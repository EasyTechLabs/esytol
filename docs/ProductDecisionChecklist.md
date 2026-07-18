# Product Decision Checklist

> **Purpose:** The single-page go/no-go gate every proposal passes before it may enter the roadmap or a sprint may build it. Combines the STRATEGY-004 admission gates, the STRATEGY-005 evidence + revenue requirements, and the score threshold. Governed by [STRATEGY-005](Strategy005RevenueFirst.md).
> **Status:** Mandatory governance artifact
> **Last Updated:** 2026-07-18

Paste this checklist into the sprint's ProductFactory record. **Every box in Sections A–C
must be checked** for a GO. Any unchecked box in A–C is an automatic NO-GO.

---

## Proposal: `<tool-or-category-name>` · Date: `<YYYY-MM-DD>`

### Section A — Hard gates (STRATEGY-004; any failure = REJECT, do not score)

- [ ] **Deterministic** — same input → same output (generators declare fresh-value design).
- [ ] **Privacy** — core value runs client-side; no user content leaves the device by default.
- [ ] **No accounts required** for the core function.
- [ ] **No backend required** for core value (a backend is allowed only for a genuinely
      impossible-client-side feature, declared in the trust surface; never to store user content).
- [ ] **Brand fit** — a trustworthy, correct, defensible utility (not entertainment/engagement bait).
- [ ] **Trust model exists** — the domain's trust surface (Finance/Developer/Everyday/…) covers it;
      a gated domain (e.g. Health) is not admitted until its review process is staffed.

### Section B — Evidence (STRATEGY-005; the research record is complete and honest)

- [ ] [Product Research Record](ProductResearchTemplate.md) is complete — all 17 fields.
- [ ] Every quantitative claim is **sourced**, or honestly marked **"unknown."**
- [ ] **No demand or revenue number was invented.**
- [ ] Existing alternatives and competitor landscape are documented with real examples.

### Section C — Commercial viability (STRATEGY-005; the revenue-first gate)

- [ ] At least one [Revenue Matrix](RevenueMatrix.md) path is **Planned/Live**, **OR** a written
      **loss-leader justification** naming the monetisable engine it feeds.
- [ ] A **distribution channel** that does **not** require SEO, an owned audience, ads, or
      cold outreach is named — **or** the resulting low distribution score is explicitly accepted.
- [ ] [Business Score](ProductScorecard.md) computed: **\____ / 100** → tier: `Build | Backlog | Hold`.
- [ ] Score tier is **Build (≥70)** to enter this sprint, or **Backlog (55–69)** with the named
      gap to close. (Hold/Reject → not this sprint.)

### Section D — Platform integrity (no regressions)

- [ ] Reuses existing engines/components where possible; adds to the shared layer, never forks it.
- [ ] **Finance-safe / Developer-safe / Everyday-safe** — names any shared surface it touches and
      confirms existing domains are unchanged.
- [ ] Maintenance owner and cadence named (static / yearly rule / ongoing).

### Section E — Governance (STRATEGY-004)

- [ ] A **Sprint Declaration** block is prepared (Platform/Domain/Category/Tool/Priority/Admission/
      Dependencies/Maintenance/Impact).
- [ ] The ProductFactory record (research + score + this checklist) will be committed on close.

---

## Decision

**Business Score:** `___ / 100` · **Tier:** `___` · **Gate result:** `PASS | FAIL`

**DECISION:** `GO — build this sprint` | `GO — backlog with named gap` | `NO-GO — <reason>`

**Signed:** `<CPO / founder>` · **Date:** `<YYYY-MM-DD>`

> A NO-GO is a success of the process, not a failure of the idea. This checklist exists to
> reject 99% of proposals so the 1% that earns money gets built.
