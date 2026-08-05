# API Error Model

> Design only. Contract: `vyora-api/openapi/openapi.yaml`.

---

## 1. The envelope

Every non-2xx response on every operation returns exactly this shape. No exceptions, no bare strings,
no HTML error pages.

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "name must be between 1 and 100 characters",
    "requestId": "9f1c2d7e-4a6b-4c31-8f10-2b7d5e9a1c44",
    "details": [{ "field": "$.name", "code": "TOO_LONG", "message": "maximum 100 characters" }]
  }
}
```

| Field       | Required        | Purpose                                                     |
| ----------- | --------------- | ----------------------------------------------------------- |
| `code`      | yes             | machine-readable class. Switch on this, never on `message`. |
| `message`   | yes             | developer-facing English                                    |
| `requestId` | yes             | UUID, matches the `X-Request-Id` response header            |
| `details[]` | when applicable | field-level failures                                        |

`additionalProperties: false` on the envelope, the error object and each field error. A response
carrying an undeclared field is a contract violation, not a tolerated extension — that is what keeps
a generated client's error handling exhaustive.

## 2. `message` is never shown to a merchant

The client already owns every merchant-facing string. Those are written in plain language, tone-checked
for the Recovery module's "never threaten, never shame" rule, and translated. A server string cannot
meet that bar: it does not know the screen, the language, or what the merchant was trying to do.

So the client switches on `code` and renders its own wording. `message` exists for logs and bug
reports.

## 3. `requestId` on every response

`X-Request-Id` is a **required** response header on all 8 operations, success and failure alike, and
is echoed inside the error body. A merchant reporting "it failed" can read one short id off the
screen, and it correlates the client log, the server log and the support ticket.

Putting it in the header only would mean a client that logs response bodies loses it. Putting it in
the body only would mean successes are uncorrelatable. Both, always.

## 4. Codes

| Code                              | HTTP | Meaning                                 | Client action              |
| --------------------------------- | ---- | --------------------------------------- | -------------------------- |
| `BAD_REQUEST`                     | 400  | malformed syntax, parameters or headers | fix; do not retry          |
| `UNAUTHENTICATED`                 | 401  | missing or invalid credentials          | re-authenticate            |
| `TOKEN_EXPIRED`                   | 401  | valid token, past `exp`                 | refresh, then retry        |
| `FORBIDDEN`                       | 403  | authenticated but not permitted         | do not retry               |
| `NOT_FOUND`                       | 404  | absent **or another workspace's**       | treat as absent            |
| `VALIDATION_FAILED`               | 422  | well-formed, contents invalid           | fix from `details[]`       |
| `VERSION_CONFLICT`                | 412  | stale `If-Match`                        | re-read, re-apply, retry   |
| `PRECONDITION_REQUIRED`           | 428  | `If-Match` omitted                      | read first, then retry     |
| `IDEMPOTENCY_KEY_REUSED`          | 409  | same key, different body                | new key                    |
| `RESOURCE_ALREADY_EXISTS`         | 409  | id exists with different content        | surface conflict           |
| `PAYLOAD_TOO_LARGE`               | 413  | batch over `maxBatchEvents`             | split, retry               |
| `RATE_LIMITED`                    | 429  | rate limit                              | back off per `Retry-After` |
| `SYNC_CURSOR_INVALID`             | 400  | malformed or foreign cursor             | discard, restart pull      |
| `SYNC_CURSOR_EXPIRED`             | 409  | before the retained window              | restart pull from scratch  |
| `SYNC_CLIENT_TOO_OLD`             | 409  | client below minimum version            | upgrade                    |
| `SYNC_SCHEMA_VERSION_UNSUPPORTED` | 409  | envelope version unsupported            | upgrade; outbox intact     |
| `DEPENDENCY_UNAVAILABLE`          | 503  | a dependency is impaired                | back off, retry            |
| `INTERNAL_ERROR`                  | 500  | unexpected                              | retry once, then report    |

`403` never appears for a cross-tenant read. Another workspace's resource is `404`, because `403`
confirms it exists.

**Retry safety.** Every operation carries an `Idempotency-Key` or is a `GET`, so nothing here is
unsafe to repeat. The distinction the table draws is between _pointless_ retries (400, 422 — the
request is wrong) and _useful_ ones (429, 503 — the server is busy).

## 5. Field errors

```json
{ "field": "$.events[3].payload.transaction.amount", "code": "OUT_OF_RANGE", "message": "…" }
```

`field` is a JSONPath into the **request**, so a batch of 500 events points at the offending one
rather than making a client bisect its own outbox. `code` is one of `REQUIRED`, `INVALID_FORMAT`,
`OUT_OF_RANGE`, `TOO_LONG`, `NOT_ALLOWED`.

`NOT_ALLOWED` is what `PATCH /parties/{partyId}` returns for an attempt to write `id`, `createdAt`,
`version` or `balance` — an explicit refusal rather than a silent ignore, so a client bug surfaces in
development instead of manifesting as "my edit didn't save".

## 6. Per-event rejection is a different mechanism

Sync push does **not** use this envelope for individual events. A batch is processed as a whole; each
event's fate is reported in the `200` body:

```json
{ "eventId": "evt_…", "reason": "SNAPSHOT_EVENT_UNSUPPORTED", "message": "…", "details": [] }
```

`RejectionReason` is a separate enum from `ErrorCode`, deliberately: an HTTP status describes what
happened to a _request_, and 49-of-50-accepted has no honest status code. Reusing `ErrorCode` here
would force either an all-or-nothing batch or a lie about the response status.

| Reason                        | Meaning                                                            |
| ----------------------------- | ------------------------------------------------------------------ |
| `SNAPSHOT_EVENT_UNSUPPORTED`  | `RestoreCompleted` / `ImportCompleted` — always rejected in v1     |
| `UNKNOWN_EVENT_TYPE`          | not in the log-v2 vocabulary                                       |
| `PAYLOAD_VERSION_UNSUPPORTED` | this type's payload shape is too old or too new                    |
| `PAYLOAD_INVALID`             | fails the type's payload schema; see `details[]`                   |
| `EVENT_ID_CONFLICT`           | same `eventId`, **different** payload — never silently overwritten |
| `EVENT_ID_MALFORMED`          | not a valid `VyoraId`                                              |
| `OCCURRED_AT_OUT_OF_RANGE`    | implausible device clock                                           |
| `AGGREGATE_MISMATCH`          | `aggregateId` disagrees with the payload                           |

A rejection is **terminal for that event**. The client quarantines it; it must never be retried
unchanged, or a permanently invalid event blocks the outbox forever.

`EVENT_ID_CONFLICT` is the one worth care: same id, different content means either a client bug or a
collision, and both are cases where guessing which version is real could destroy a correct entry.
Rejecting and surfacing is the only safe answer.

## 7. What the server must never do

- return a merchant-facing string
- return `403` for another workspace's resource
- return a `200` for a failed write
- omit `X-Request-Id`
- return an error outside this envelope
- include a stack trace, SQL, or an internal hostname in `message`

The last one matters because `message` is developer-facing but still crosses the network to a device
the server does not control.
