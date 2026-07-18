# Research Confidence Framework

> **Purpose:** Grade how much a research finding can be trusted, so uncertainty is explicit and comparable — and so "unknown" can never quietly become "assumed." Governed by [RESEARCH-001](Research001MarketResearch.md).
> **Status:** Mandatory research artifact
> **Last Updated:** 2026-07-18

Every field of a [Research Record](ResearchTemplate.md) carries a confidence level. Confidence is
a function of **evidence tier** ([EvidenceStandards](EvidenceStandards.md)) and **corroboration**,
not of how sure the researcher feels. Two researchers must assign the same level from the same
sources — that is the whole point.

## The four levels

| Level       | Definition                                                               | Evidence required                                        | May support a build decision?                          |
| ----------- | ------------------------------------------------------------------------ | -------------------------------------------------------- | ------------------------------------------------------ |
| **High**    | The claim is well-established; further research is unlikely to change it | ≥2 independent sources, ≥1 **T1**, current (dated)       | Yes — the decision can rest on it                      |
| **Medium**  | The claim is probably true but under-corroborated or partly indirect     | ≥1 **T2**, or a consistent pattern across several **T3** | Yes, but flagged; decision notes the risk              |
| **Low**     | A weak signal or a single unaggregated source; plausible, unproven       | A single **T3**, or **T4** used as a hypothesis          | No — informs direction only; cannot carry the decision |
| **Unknown** | No credible evidence found                                               | None                                                     | No — and it must **stay** unknown                      |

## The two rules that make this real

1. **Unknown is never converted into an assumption.** An "unknown" field stays "unknown" in the
   record and moves to the [Unknowns list](ResearchTemplate.md) with the evidence that would resolve
   it. Filling an unknown cell with a plausible guess to make the record look complete is the single
   most damaging thing a researcher can do — it launders ignorance into apparent fact and poisons
   every downstream gate. Where the research genuinely must reason past evidence, it is written
   **[ASSUMPTION]**, dated, with a test — visibly, never as a fact.
2. **Overall confidence is capped by the weakest decision-critical field.** A record is only as
   trustworthy as the shakiest thing the build depends on. If distribution is Low, the _overall_
   confidence is Low — no matter how High the problem and demand fields are. You cannot average a
   fatal unknown away.

## How confidence flows into scoring (no scoring change)

RESEARCH-001 does not alter STRATEGY-005's [scorecard](ProductScorecard.md); it _feeds_ its existing
rule that "unsourced / low-confidence fields score at the conservative end." Concretely:

| Field confidence | Effect on the STRATEGY-005 dimension it informs                           |
| ---------------- | ------------------------------------------------------------------------- |
| **High**         | Score the dimension on its merits                                         |
| **Medium**       | Score on merits, but round half-down (STRATEGY-005 rule 4)                |
| **Low**          | Score at the conservative end (0–2 of 5)                                  |
| **Unknown**      | Score conservatively **and** list as an Unknown to resolve before funding |

This means a genuinely uncertain proposal _cannot_ accumulate a high Business Score by asserting
confident-sounding numbers — the confidence grade drags the score down honestly.

## Confidence and the recommendation

| Overall confidence                                                      | Typical recommendation                                                        |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **High**                                                                | PROCEED to Gate 1                                                             |
| **Medium**                                                              | PROCEED with named unknowns to resolve, or a small validation step first      |
| **Low**                                                                 | PARK — the evidence does not yet support a build; name what would change that |
| **Unknown on a decision-critical field** (esp. distribution or revenue) | Cannot proceed                                                                |

## The auditor's test

A different person, handed the Research Record and its citations, must be able to:

1. Open every source and confirm it says what the record claims,
2. Re-derive each field's confidence level from the evidence tiers and corroboration,
3. Arrive at substantially the same overall confidence and recommendation.

If they cannot, the record is not finished — regardless of how polished it reads. Reproducibility,
not eloquence, is the standard.
