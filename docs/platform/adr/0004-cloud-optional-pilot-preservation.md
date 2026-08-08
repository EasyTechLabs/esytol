# ADR-0004 — Cloud is opt-in; the pilot stays local-first

**Status:** Accepted · **Date:** 2026-08-05

## Context

Vyora's stated product principle (`vyora/README.md`):

> _"Local-first — data lives only on the merchant's device; no backend, no accounts, no cloud
> (cloud is an evidence-gated future spike, not a default)."_

`ProgramPlan.md` rates _"building the MLP before the pilot validates adoption"_ as **High** risk and
lists optional cloud backup as an evidence-gated spike, explicitly _not committed_.

Discovery found that merchants' primary objection to existing apps is data leaving their phone —
often framed as a tax concern. RC1 is deployed; **no merchant has used it yet.**

## Decision

**The platform is built. It is not switched on.**

1. The pilot ships and runs **entirely local-first**. No API dependency, no network call carrying
   ledger data.
2. Cloud sync is **opt-in per merchant**, with explicit, revocable consent. Never a default, never a
   silent upgrade, never bundled into an app update.
3. **No merchant data reaches a server before Phase E**, which is blocked on six preconditions
   (`migration-plan.md`).
4. The web app **must remain fully functional with the API switched off**. Enforced by defaulting
   every flag to `false` and validating that path in CI.
5. Out of scope permanently: cross-merchant visibility, credit scoring, data sharing, selling
   merchant or customer data.

## Consequences

**Good**

- The pilot measures the product, not the infrastructure
- Merchants can be told truthfully: _"nothing leaves this phone"_ — still true on the shipped build
- If the pilot shows multi-device is unwanted, Phases D–E are dropped with nothing to unwind
- Cloud-off rollback is safe because **the device log is authoritative and the server is a copy** —
  not the other way round

**Bad**

- API work may prove unnecessary; that cost is accepted deliberately
- Two data paths must be maintained during Phases C–D
- Opt-in adoption will be lower than default-on. That is the point.

## Preconditions before any merchant data reaches the cloud

| #   | Requirement                                          | Status                  |
| --- | ---------------------------------------------------- | ----------------------- |
| 1   | Pilot evidence that merchants want multi-device      | **not started**         |
| 2   | Real authentication                                  | **not designed**        |
| 3   | Privacy policy + revocable consent                   | **not started**         |
| 4   | Deletion & retention — erasure vs event immutability | **unresolved conflict** |
| 5   | Server backup and restore, tested                    | **not started**         |
| 6   | Delete/create race resolved (ADR-0003)               | **unresolved**          |

**Any one of these unmet blocks Phase E.** #4 is the hardest: an immutable event log and a
right-to-erasure obligation genuinely conflict, and resolving it may require crypto-shredding — a
significant redesign that is far cheaper to discover now than after Phase D.
