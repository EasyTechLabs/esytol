# Engine Investment Profile

> **Purpose:** A one-page, sixteen-field profile for every engine, so a funding decision is made on recorded evidence, not memory. Governed by [STRATEGY-006](Strategy006CapitalAllocation.md).
> **Status:** Mandatory governance artifact
> **Last Updated:** 2026-07-18

Every live engine and every proposed engine carries a profile. It is created at Research (from
the [Product Research Record](ProductResearchTemplate.md)) and updated at every Quarterly CEO
Review. An engine without a current profile cannot receive capital.

## The template (copy per engine)

```
Engine:                <name>  (lib/<file>)
Portfolio:             <Revenue | Acquisition | Authority | Platform | Experimental>
1.  Mission:           <one sentence: the value this engine exists to return>
2.  Problem solved:    <the specific, real problem>
3.  Target users:      <named audience, not "everyone">
4.  Primary KPI:       <the portfolio's KPI, made specific to this engine>
5.  Revenue KPI:       <the money metric, or "loss-leader → <named engine it feeds>">
6.  Maintenance cost:  <static | yearly (name the rule) | ongoing (name the source)>
7.  Engineering complexity: <1–10; net-new vs reused>
8.  Business Score:    <0–100 from the ProductScorecard, with date>
9.  Revenue Matrix row: <the 12-surface L/P/R/– row from RevenueMatrix.md>
10. Risk:              <honest primary failure mode>
11. Dependencies:      <engines/components/marketplaces it relies on>
12. Strategic importance: <1–5; how it advances STRATEGY-003 / the moat>
13. Lifecycle stage:   <Idea→Research→Validation→Approval→Implementation→Growth→
                        Optimization→Monetization Expansion→Maintenance→Retirement>
14. Review schedule:   <monthly | quarterly | at kill-date>
15. Owner (document):  <the governing doc, e.g. RevenueMatrix.md — never a person>
16. Capital verdict:   <Invest more | Maintain | Freeze | Retire>  (set at CEO review)
```

**Rule on field 15 (Owner).** The owner is a _document_, never a person — EasyTechLabs is a
one-engineer company, so accountability is vested in the governing artifact that must be kept
current, not in an individual who is already on every engine.

## Filled example A — Income Tax (Revenue)

```
Engine:                Income Tax  (lib/incomeTax)
Portfolio:             Revenue
1.  Mission:           Be the correct, citeable Indian income-tax computation (old vs new).
2.  Problem solved:    Indian tax is hard, changes yearly, and must be exactly right.
3.  Target users:      Fintech/payroll developers; CAs during filing season; salaried filers.
4.  Primary KPI:       Revenue — API subscribers / white-label licences.
5.  Revenue KPI:       First payment → MRR from the tax/salary API.
6.  Maintenance cost:  Yearly (Finance Act — slabs/rebate/surcharge each FY). First-charge item.
7.  Engineering complexity: 2/10 to expose (engine exists, tested); the math is done.
8.  Business Score:    ~86 / 100 (2026-07-18) → Build tier.
9.  Revenue Matrix row: Website L · API P · SDK P · Widget P · White-label P · Enterprise P ·
                        Extension – · AI-Tool P · Affiliate P · Ads R · Subscription P · Licensing P
10. Risk:              A marketplace buyer must discover it; commodity perception; yearly churn.
11. Dependencies:      Vercel deploy; RapidAPI (marketplace + billing).
12. Strategic importance: 5/5 — the STRATEGY-003 computation-layer thesis, made real.
13. Lifecycle stage:   Growth → Monetization Expansion (Website live; API is the next surface).
14. Review schedule:   Monthly (it is the funded Revenue position).
15. Owner (document):  RevenueMatrix.md
16. Capital verdict:   Invest more (the quarter's primary Revenue position).
```

## Filled example B — Developer Experience layer (Platform)

```
Engine:                Developer Experience layer  (features/dev/*, lib/dev/*)
Portfolio:             Platform
1.  Mission:           Make every developer tool cost only its own transform logic.
2.  Problem solved:    Re-building an editor/parser/crypto/validation per dev tool.
3.  Target users:      Internal — the next ~20 developer tools.
4.  Primary KPI:       Cost-to-add-a-tool (hours to ship the Nth dev tool).
5.  Revenue KPI:       Loss-leader → feeds Acquisition (free dev tools) and future dev API.
6.  Maintenance cost:  Ongoing-low (CodeMirror/js-yaml dep drift).
7.  Engineering complexity: 6/10 (built in DEVELOPER-001; now stable).
8.  Business Score:    n/a (Platform — measured on reuse, not the scorecard).
9.  Revenue Matrix row: Website L · others – (Platform is not sold directly).
10. Risk:              Over-building surface no funded tool needs (gold-plating).
11. Dependencies:      CodeMirror, js-yaml; the Tool Framework.
12. Strategic importance: 4/5 — the substrate for the Developer domain.
13. Lifecycle stage:   Maintenance (shipped; extended only when a funded dev tool needs it).
14. Review schedule:   Quarterly (or when a funded engine is blocked).
15. Owner (document):  docs/DeveloperExperience.md
16. Capital verdict:   Maintain (invest only to unblock funded dev tools; Platform ≤ 10% cap).
```

## Filled example C — Word Counter (Acquisition)

```
Engine:                Word Counter  (lib/everyday/textStats)
Portfolio:             Acquisition
1.  Mission:           A high-volume front door that bridges visitors toward paid surfaces.
2.  Problem solved:    Fast, private word/character/reading-time counting.
3.  Target users:      Writers, students, marketers.
4.  Primary KPI:       New + returning visitors; onward navigation.
5.  Revenue KPI:       Loss-leader → declared bridge to the Finance/API funnel (unproven; Gate 0).
6.  Maintenance cost:  Static (Unicode rules).
7.  Engineering complexity: 1/10 (shipped, trivial).
8.  Business Score:    ~48 / 100 → funded only as a declared loss-leader.
9.  Revenue Matrix row: Website L · Extension P · others –
10. Risk:              Commodity; traffic that never bridges anywhere → retire candidate.
11. Dependencies:      lib/dev/metrics; EverydayTrust; Tool Framework.
12. Strategic importance: 2/5.
13. Lifecycle stage:   Growth (data-gated on Gate 0).
14. Review schedule:   Quarterly.
15. Owner (document):  docs/Platform004EverydayCategory.md
16. Capital verdict:   Freeze new Acquisition builds until the bridge is proven (Gate 0).
```
