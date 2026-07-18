# Distribution Research Template

> **Purpose:** Force every proposal to answer _how a user actually discovers it_ — the constraint that kills more products than any other. Governed by [RESEARCH-001](Research001MarketResearch.md).
> **Status:** Mandatory research artifact
> **Last Updated:** 2026-07-18

**The hard rule:** if, after this research, distribution is **unknown**, the proposal **cannot
proceed**. Distribution is not a marketing detail to solve later; it is a research finding that
must exist _before_ a build is funded. A brilliant product no one can discover is worth nothing —
the lesson of REVENUE-001 / MONEY-001, made a gate here.

## The distribution question, per channel

For each channel, answer: **is it viable for us, today, given no owned audience and Gate-0
blindness?** Grade each and cite the evidence.

```
Proposal: <name>   ·   Date: <YYYY-MM-DD>

Channel            Viable?  Evidence / reasoning                                    [tier · confidence]
─────────────────  ───────  ─────────────────────────────────────────────────────
SEO / organic      <Y/N/?>  Ranks in months, needs authority — usually N pre-Gate-0
AI search / GEO     <Y/N/?>  Citeable/agent-callable? (FAQ/schema/MCP)
Marketplace         <Y/N/?>  A marketplace with its OWN buyers? (RapidAPI, Apify/MCP,
                             VS Code, Chrome, Fiverr/Upwork, Gumroad) — the strong path
Embedding / widget  <Y/N/?>  Can partners embed it? Who, and why?
Direct navigation   <Y/N/?>  Would users type/bookmark it? (needs brand — usually N early)
Enterprise          <Y/N/?>  A named buyer + a reachable channel (usually long-cycle)
Referral / sharing  <Y/N/?>  A natural share moment? (existing ShareButtons)
API                 <Y/N/?>  Developers find it on an API marketplace?
Browser extension   <Y/N/?>  Store traffic (VS Code instant; Chrome has review delay)
```

## Scoring guidance (feeds STRATEGY-005's distribution weight, unchanged)

- **Strongest (High):** a marketplace that supplies its own buyers _and_ its own billing, listable
  now — RapidAPI/Apify for APIs, VS Code for dev tools, Fiverr/Upwork for productised services.
  These need no audience and no SEO.
- **Medium:** AI-search/GEO (real but slow), referral/sharing (needs a share moment), embedding
  (needs partners).
- **Weak (Low) until Gate 0:** SEO and "put it on esytol.com" — we have no proven traffic, so these
  are aspirational, not evidence, and score low.
- **Unknown across all channels → STOP.** The record ends; the proposal does not reach Gate 1.

## Required output (rolls up into Research Record field 7)

1. The **primary channel** chosen, with evidence it reaches a _paying_ or _converting_ user without
   SEO/audience/ads/outreach — or a labelled `[ASSUMPTION]` with the test that would confirm it.
2. The **secondary channel** (fallback).
3. An honest statement of **what we are NOT relying on** and why (e.g. "not SEO — no proven traffic").

> A proposal that reaches Gate 1 has, by definition, a named, evidenced distribution channel. That
> is the single most important thing this research system enforces.
