# OpenAPI Contract Design

> Contract: `vyora-api/openapi/openapi.yaml` (OpenAPI 3.1).
> **Design only.** No implementation, schema, migration or client exists.
> `vyora-api/` currently holds the contract and nothing else.

---

## 1. Surface

Eight operations. Nothing speculative — every path below is required by a screen
that already ships.

| Method  | Path                        | Auth   | Purpose                                     |
| ------- | --------------------------- | ------ | ------------------------------------------- |
| `GET`   | `/api/v1/health`            | none   | liveness + dependency status                |
| `GET`   | `/api/v1/me`                | bearer | the caller's resolved workspace/user/device |
| `GET`   | `/api/v1/parties`           | bearer | list, filter, paginate                      |
| `POST`  | `/api/v1/parties`           | bearer | create (client-minted id)                   |
| `GET`   | `/api/v1/parties/{partyId}` | bearer | fetch one                                   |
| `PATCH` | `/api/v1/parties/{partyId}` | bearer | update, `If-Match` required                 |
| `POST`  | `/api/v1/sync/push`         | bearer | append immutable client events              |
| `GET`   | `/api/v1/sync/pull`         | bearer | read events after a cursor                  |

`/health` is the only unauthenticated path, and it returns no merchant data.

## 2. Schemas

**Primitives** — `Uuid`, `Timestamp`, `BusinessDate`, `Money`, `VyoraId`, `PartyRef`, `SyncCursor`.

**Errors** — `ErrorEnvelope`, `ErrorObject`, `FieldError`, `ErrorCode`. See `api-error-model.md`.

**System** — `Health`, `Me`.

**Parties** — `Party`, `PartyBalance`, `PartyPosition`, `CreatePartyRequest`, `UpdatePartyRequest`,
`PartyPage`, `PageInfo`.

**Events** — `ClientEventEnvelope`, `ClientEvent` (a 12-way discriminated union), `ServerEvent`, one
`…Event` wrapper and one `…Payload` per log-v2 event type, plus the records they carry
(`PartyRecord`, `TransactionRecord`, `PaymentRecord`), `EntryKind`, `PaymentKind`, `EventType`.

**Sync** — `PushRequest`, `PushResponse`, `RejectedEvent`, `RejectionReason`, `PullResponse`.

All twelve event payloads are specified in full rather than left as an open object. It costs more
YAML, but it means a malformed event is a named contract failure the server can reject precisely
instead of a generic parse error the client cannot act on.

## 3. Conventions applied everywhere

| Concern            | Rule                                                                             |
| ------------------ | -------------------------------------------------------------------------------- |
| Version prefix     | `/api/v1` on every path                                                          |
| Timestamps         | ISO-8601 instants with an offset; `BusinessDate` is a separate `YYYY-MM-DD` type |
| Server ids         | bare UUID — `merchantId`, `userId`, `deviceId`, `requestId`                      |
| Domain ids         | `VyoraId` — client-minted, `pty_`/`txn_`/`pay_`/`evt_` prefix (see §4)           |
| Optimistic locking | `version` integer in the body **and** an `ETag`; `If-Match` required on `PATCH`  |
| Idempotency        | `Idempotency-Key` header required on every `POST` and `PATCH`                    |
| Pagination         | opaque cursor + `limit` (1–200, default 50), `PageInfo { nextCursor, hasMore }`  |
| Correlation        | `X-Request-Id` on every response, echoed as `error.requestId`                    |
| Money              | non-negative integer rupees; direction comes from `kind`, never a sign           |

The single signed number in the contract is `PartyBalance.net`, and it is derived and read-only.

## 4. Decisions worth defending

**Client-minted domain ids, with a prefix.** The shipped app mints `pty_<uuid>` on the device the
moment the merchant types a name — long before any request exists. The contract accepts that format
as-is. Forcing bare UUIDs would mean rewriting event logs already on merchants' phones, which
violates "the server must ingest log v2 without translation" (`domain-model.md` §4).

> The `VyoraId` pattern is a length range rather than a strict UUID because `newId()` falls back to a
> base-36 suffix when `crypto.randomUUID` is unavailable. Those ids exist in the field. A stricter
> pattern would reject real merchant data.

**`POST /parties` returns `200` on identical replay, `409` only on conflict.** Retrying a create
that timed out must be safe; retrying it with _different_ content must not silently win.

**`If-Match` is required, not optional.** An optional precondition is one a client forgets under
deadline, and the failure mode is a silently overwritten edit from another device.

**`404`, never `403`, for another workspace's resource.** A `403` would confirm the resource exists.
Absent and not-yours are deliberately indistinguishable.

**`GET /me` is the only place `merchantId` appears in a response**, and it appears in no request at
all. A client _discovers_ its workspace; it never asserts one.

**No `merchants` CRUD endpoint.** Workspaces are server-owned. Onboarding is a deferred decision
(§6), and shipping a create-merchant endpoint before that decision would prejudge it.

## 5. Party rules, as encoded

- `Party` is the only contact resource. No `/customers`, no `/suppliers`, no such schema.
- No `role`, `type`, `isCustomer` or `partyType` field on any party schema. Verified mechanically.
- Direction lives on the entry: `EntryKind` is `given`/`taken`, `PaymentKind` is `received`/`paid`.
- `PartyPosition` (`owes_merchant`, `merchant_owes`, `settled`, `no_entries`) is a **read-time
  filter over a derived balance**, never a stored column.

**Why a party appears in both credit and debit flows** — documented on the `Parties` tag, the
`EntryKind` schema and `PartyPosition`. In Indian retail credit the same wholesaler routinely sells
stock to a shop on credit and buys goods from it on credit. A stored role forces a false choice, and
it goes stale the instant a late offline event arrives — which offline-first makes the normal case,
not the exception. `PartyBalance.net` is signed precisely so one party can sit on either side over
time without any schema change.

## 6. Deferred decisions and their phase gates

Recorded, not solved. None is blocked on more design; each needs a founder call or pilot evidence.

| #   | Decision                                                              | Why it is not answered here                                                                                                                                                                                                   | Gate                                                                                                    |
| --- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 1   | **Party deleted on one device while another records an entry for it** | No safe automatic answer exists. Resurrecting the party silently un-deletes something the merchant chose to remove; orphaning the entry loses money they are owed. This is a product judgement about which surprise is worse. | **Blocks Phase D.** Both events are accepted and stored today; only the _projection rule_ is undecided. |
| 2   | **Legal erasure vs immutable event history**                          | Genuinely contradictory requirements. May require crypto-shredding — a storage redesign, not a contract change.                                                                                                               | **Blocks Phase E.** No merchant data reaches a server before then.                                      |
| 3   | **Do snapshots ever sync?**                                           | v1 says no, and the contract enforces it with `SNAPSHOT_EVENT_UNSUPPORTED`. Whether restore should ever propagate across devices is a product call.                                                                           | **Blocks Phase D.** Reversible: allowing them later is additive.                                        |
| 4   | **Real onboarding / authentication provider**                         | The tenant _model_ is settled (`auth-and-tenant-model.md`); the identity _provider_ is not. The contract depends only on "a bearer token resolves to a workspace", so any provider satisfies it.                              | **Blocks Phase E.** Phase B–D run on the development scheme.                                            |

Two further items from `domain-model.md` §6 remain open but are lower-risk and do not block a phase:
duplicate parties created by name on two devices (proposal: surface a merge prompt, never auto-merge),
and concurrent `ContactUpdated` on one field (proposal: last-write-wins by `occurredAt`, ties broken
by `eventId`).

## 7. Validation performed

`@redocly/cli lint` against the built-in recommended ruleset: **0 errors, 0 warnings**.
`@redocly/cli bundle` resolves every `$ref` with no unresolved references.

Eleven contract assertions were run over the parsed, fully dereferenced document — tenant leakage,
party-role absence, event-shaped sync, error-envelope coverage, correlation-id coverage, idempotency
coverage, and exact endpoint surface. All pass. Results and method: `auth-and-tenant-model.md` §5.

## 8. Contradiction found against earlier design

`target-architecture.md` §3 placed the `auth` module in **Phase E** with _"design not started"_. That
is now false: this milestone specifies bearer authentication and a development scheme that Phase B
endpoints depend on. Authentication cannot be a Phase E concern when every Phase B endpoint except
`/health` requires a token.

Corrected in place — the module table now separates the **scheme** (Phase B) from the **real identity
provider** (Phase E). `migration-plan.md` needed no change: its Phase E precondition already read
_"Real authentication — not the development identity boundary"_, which anticipated exactly this split.
