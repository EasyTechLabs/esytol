# Pilot Metrics

> **Two sources only: Founder Mode, and what you observed.** Vyora has no telemetry and never will,
> so nothing arrives on its own. If a number is not in this sheet, it was not measured.
>
> Leave unknowns blank. Never estimate — an invented number is worse than a gap.

---

## Where each number comes from

Open **Founder Mode** on the merchant's phone: tap the **"Alpha"** badge five times.

| Panel       | Gives you                                                                            |
| ----------- | ------------------------------------------------------------------------------------ |
| Ledger      | Contacts · Credits · Payments · Entries · Events in log · Receivable · Payable · Net |
| Device      | Storage used · Log format version · **Last backup** · Imports · Deletions            |
| Integrity   | All-passed, or which check failed                                                    |
| Performance | Command and index timings for that session                                           |

Everything else — install, offline use, satisfaction, retention — comes from **your own
observation**. Mark the source in every cell.

## Weekly sheet — one per merchant

| Metric                | Source           | Baseline | W1  | W2  | Notes                          |
| --------------------- | ---------------- | -------- | --- | --- | ------------------------------ |
| Days active this week | observed         |          |     |     | days they recorded anything    |
| Credits recorded      | Founder Mode     |          |     |     | cumulative                     |
| Payments recorded     | Founder Mode     |          |     |     | cumulative                     |
| Entries total         | Founder Mode     |          |     |     |                                |
| Events in log         | Founder Mode     |          |     |     |                                |
| Receivable            | Founder Mode     |          |     |     |                                |
| Storage used          | Founder Mode     |          |     |     | watch it approach 5 MB         |
| **Last backup**       | Founder Mode     |          |     |     | **red flag if > 7 days**       |
| Exports taken         | Founder Mode     |          |     |     |                                |
| Restores performed    | Founder Mode     |          |     |     | should normally be 0           |
| Chase opened          | observed / asked |          |     |     | unprompted use only            |
| Closing used          | observed / asked |          |     |     | unprompted use only            |
| Installed as app      | Settings         |          |     |     | Yes / No                       |
| Used offline          | asked            |          |     |     | did they use it without signal |
| Errors seen           | merchant report  |          |     |     | cross-ref `BugReport.md`       |
| Integrity             | Founder Mode     |          |     |     | all-passed / FAILED            |

## One-time timings — record on onboarding day

| Metric                                | How                                     | Merchant |
| ------------------------------------- | --------------------------------------- | -------- |
| **Time to first credit**              | stopwatch, from opening the app         |          |
| **Time to first credit, 3rd attempt** | the real number — the first is learning |          |
| **Time to first recovery**            | day they first opened Chase unprompted  |          |
| **Time to first backup**              | day they first exported                 |          |
| Install completed                     | onboarding day, or later, or never      |          |

## Judgement calls — record honestly

| Metric                | Scale                                      | W1  | W2  |
| --------------------- | ------------------------------------------ | --- | --- |
| **Satisfaction**      | 1–5, from the interview, **your reading**  |     |     |
| **Retention**         | still using unprompted on day 10? Yes / No |     |     |
| Notebook still in use | not at all / alongside / mostly notebook   |     |     |

**Satisfaction is your judgement, not theirs.** Do not ask them to score it — merchants are polite.
Score it yourself from what they said and did, and write one sentence of justification.

## The three numbers that decide the pilot

Everything above is context. These decide it:

1. **Day-10 unprompted use** — are they still recording without you asking?
2. **Book accuracy** — does their Vyora balance match reality, checked at least once?
3. **Backup habit** — have they exported without being reminded?

A merchant scoring yes on all three has adopted it. Enthusiasm without these is noise.

## Aggregate — end of pilot

|                         | Merchants |
| ----------------------- | --------- |
| Onboarded               |           |
| Installed as app        |           |
| Still using at day 10   |           |
| Exported unprompted     |           |
| Reported a Critical bug |           |
| Would keep using it     |           |
| Asked to stop           |           |
