# ADR-0002 — Party is the core domain entity; customer and supplier are derived views

**Status:** Accepted · **Date:** 2026-08-05

## Context

VYORA-PLATFORM-001 proposed a `Customer` resource as the first vertical slice. That contradicts
Vyora's shipped domain model.

`lib/vyora/types.ts` has no customer type. It has `Party`, and **direction lives on the entry**:
`Transaction.kind` is `given | taken`, `Payment.kind` is `received | paid`. `types.ts` says so
explicitly:

> _"Every party is simply a Party — they can be a customer, supplier, contractor, or friend at the
> same time. The DIRECTION of each entry (not a fixed role) decides whether a party owes the merchant
> or the merchant owes them, so one party can be both over time."_

This is not incidental. Indian retail credit routinely has the same person as both — a shopkeeper
buys stock from a wholesaler who also buys goods on credit from the shop.

## Decision

**`Party` is the only persisted contact entity. "Customer" and "supplier" are derived views over
entry direction and never stored.**

- API resource is `/api/v1/parties`, never `/customers`
- No `role`, `type` or `isCustomer` column
- Role may be a **filter** on reads, computed from the derived net balance
- A party with no entries has **no role**, and that is a valid state

## Consequences

**Good**

- The API round-trips the shipped domain without translation
- No migration is needed if a party changes role — there is nothing to change
- The Recovery module already relies on this: it filters `net > 0` and must never chase a supplier

**Bad**

- "Customer" is more familiar to API consumers; `/parties` needs explaining
- Role filters cost a balance derivation, which is a fold, not a column read

**Rejected:** storing a denormalised role for query speed. It would be a second source of truth and
would go stale the moment a late offline event arrived — the normal case in an offline-first system.

## Enforcement

Any API contract introducing a customer or supplier _entity_ violates this ADR. Reviewers should
reject it. Filters and view names are fine; entities are not.
