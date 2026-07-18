# Competitor Analysis Template

> **Purpose:** Standardise how every competitor is researched, so competitive conclusions are reproducible and not cherry-picked. Governed by [RESEARCH-001](Research001MarketResearch.md).
> **Status:** Mandatory research artifact
> **Last Updated:** 2026-07-18

Research the **real** incumbents — the ones a user actually chooses between today, not a
flattering strawman. A record that finds "no competitors" has almost always defined the audience
too narrowly; the true competitor is often "a free tool + a spreadsheet" or "do nothing." Analyse
the top 3–5. Every field is cited per [EvidenceStandards](EvidenceStandards.md).

## Per-competitor record (copy per competitor)

```
Competitor: <name>   ·   URL: <url>   ·   Date: <YYYY-MM-DD>

1. Strengths        — what they genuinely do well (why users pick them).      [evidence · confidence]
2. Weaknesses       — the real gaps (India-specificity, correctness, privacy,
                      no API, stale, poor UX). This is where our wedge is.     [evidence · confidence]
3. Pricing          — exact tiers from their pricing page (T1). Free? Freemium?
                      Per-seat? Metered?                                        [T1 · confidence]
4. Technology       — stack/approach where knowable (client vs server, API,
                      open-source?). Informs feasibility + differentiation.     [evidence · confidence]
5. Traffic source   — how they get users (SEO, marketplace, community, ads,
                      brand). Reveals the distribution game we'd be entering.   [T2/T3 · confidence]
6. Monetisation     — how they actually make money (subscription, ads, API,
                      affiliate, lead-gen, enterprise).                         [evidence · confidence]
7. Trust            — their credibility signals (sources cited? reviews?
                      security posture? reputation in communities?).           [T3 · confidence]
8. Differentiation  — the one sentence on why a user would choose US over them,
                      grounded in 1–2 above. If you can't write it, don't build.[confidence]
```

## Rules

- **Pricing is read from the source (T1).** A competitor's pricing page is authoritative for
  price; their marketing ("trusted by millions") is T4 and does not count.
- **"Traffic source" is a strategic tell.** If every incumbent wins on SEO and we've established we
  cannot win on SEO (no audience, Gate 0), that is a distribution warning, not a detail.
- **The differentiation sentence is mandatory and load-bearing.** It is the hypothesis the whole
  proposal rests on. "Ours is nicer" is not differentiation; "ours is the only India-correct one
  with an API" is.
- **Include the invisible competitor.** "Do nothing," "a free web tool," "ChatGPT gives it free,"
  and "a spreadsheet" are competitors. Omitting them is how a proposal fools itself.

## Competitive summary (rolls up into Research Record field 4)

After the per-competitor records, state in 2–3 sentences: how crowded the space is, how good the
incumbents are, and the **specific, defensible gap** the proposal exploits — with the confidence
that gap is real and durable. If the honest answer is "saturated by excellent free tools with no
gap," the recommendation is REJECT, and that is a successful research outcome.
