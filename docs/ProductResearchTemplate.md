# Product Research Template

> **Purpose:** The evidence record every proposed tool or category must complete **before** it can be scored or approved. Governed by [STRATEGY-005](Strategy005RevenueFirst.md).
> **Rule:** Every quantitative field must cite a **source**. A field with no credible source is written **"unknown"** and scored conservatively — never guessed upward. Our own analytics are blind until Gate 0, so demand evidence comes from _external_ sources.
> **Status:** Mandatory governance artifact
> **Last Updated:** 2026-07-18

Copy this template into the sprint's ProductFactory record and fill every field. An
incomplete record cannot proceed to [scoring](ProductScorecard.md).

---

## Research Record: `<tool-or-category-name>`

**Date:** `<YYYY-MM-DD>` · **Proposed by:** `<name>` · **Domain:** `<Finance | Developer | Everyday | …>`

### 1. Problem statement

One or two sentences: the specific, real problem this solves. Not "people like tools" —
the concrete job. If you cannot state it in one sentence, it is not ready.

### 2. Target audience

Who exactly has this problem? (e.g. "Indian payroll-SaaS developers", "content writers",
"CAs during filing season"). Name a person, not "everyone."

### 3. Existing alternatives

What do they use today? List real competitors/substitutes with URLs. "Nothing" is almost
always wrong and usually means the audience is undefined.

### 4. Search intent

What does the user type / want when they arrive? Informational, transactional,
navigational? Quote 2–3 representative queries.

### 5. Commercial intent

Does the searcher/user intend to spend, or is there a clear _paying buyer_ adjacent to
them? (High = a developer with a budget and a deadline; low = a student wanting a free
answer.) **Source required.**

### 6. Search demand

Estimated monthly volume for the core queries, **with the tool used** (Keyword Planner,
Ahrefs/SEMrush free tier, Google Trends). If unmeasurable → "unknown." Never invent a number.

### 7. AI search potential

Will AI assistants cite or _call_ this? (FAQ-shaped facts, formulae, an API an agent can
invoke.) Note structured-data / MCP / tool-calling fit.

### 8. Competitor landscape

How crowded and how good are the incumbents? Are they free, paid, abandoned, or excellent?
Where is the gap (India-specificity, correctness, privacy, API access)? **Cite examples.**

### 9. Marketplace opportunities

Which marketplaces already aggregate buyers for this? (RapidAPI, Apify/MCP, VS Code,
Chrome, Fiverr/Upwork, Gumroad, GitHub.) List listing counts / competitor prices as evidence.

### 10. Revenue paths

Which of the [Revenue Matrix](RevenueMatrix.md) surfaces are credible for this engine
(API / SDK / widget / white-label / enterprise / extension / AI-tool / affiliate /
subscription / licensing)? At least one must be **Planned**, or a written loss-leader
justification supplied.

### 11. Distribution channels

How does a _paying buyer_ find this **without** SEO, an owned audience, ads, or cold
outreach? Name the channel. "Our website" scores low until Gate 0 proves traffic.

### 12. Engineering effort

Rough build estimate (hours/days) and what is genuinely new vs reused. Lower is better,
but low effort alone never justifies a build.

### 13. Maintenance effort

Will the rules/behaviour change (yearly tax rules, API deprecations)? Static = cheap;
churny = a recurring tax on the team. **Name the source of change.**

### 14. Engine reuse

Which existing engines/shared components does this leverage? A proposal that monetises an
existing engine through a new surface is worth far more than a from-scratch engine.

### 15. Strategic value

How does it advance STRATEGY-003 (the correctness/verification layer for India's numbers),
the platform moat, or cross-domain leverage? Loss-leaders declare their strategic role here.

### 16. Risks

The honest failure modes: no buyer discovers it, commodity/free elsewhere, correctness
liability, maintenance churn, marketplace approval delay, legal/ToS (e.g. scraping).

### 17. Final weighted business score

Computed via the [ProductScorecard](ProductScorecard.md). Record the sub-scores, the
total (0–100), the tier (Build / Backlog / Hold / Reject), and the STRATEGY-004 gate result.

---

### Evidence checklist (must be true to proceed)

- [ ] Every quantitative field has a cited source, or is honestly marked "unknown."
- [ ] At least one Revenue Matrix path is Planned, **or** a written loss-leader justification.
- [ ] A distribution channel that does not require SEO/audience/ads/outreach is named (or the low score accepted).
- [ ] STRATEGY-004 hard gates pass (determinism, privacy, brand, trust model, no accounts, no backend-for-core).
- [ ] No demand or revenue number was invented.
