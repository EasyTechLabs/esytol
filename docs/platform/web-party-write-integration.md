# Web Party Write Integration

> Development-only. Create and update only. Both flags default to **off**.
> Reads: `web-party-read-integration.md` · Evidence: `web-party-write-validation.md`.

---

## 1. What this is

A developer can point the Vyora Parties screen at a locally running `vyora-api`
and **create** and **update** parties there, to check the contract end to end.

It is not sync, not migration, and not a change to where a merchant's data
lives. With the flags off — the committed default — every write goes to the
device exactly as before.

## 2. The rule this slice is built around

> **One action, one destination. Never both, never one after the other.**

When remote writes are on, a create goes to the API and _only_ the API. When
they are off, it goes through the local command engine and _only_ there.

There is no dual write, and — the part that matters most — **no fallback after
a failed remote write.** The merchant pressed Add once. Turning that into two
records, one on the device and one possibly half-applied on the server, leaves
nobody able to say which is real. A failed write must simply fail, visibly,
with the form still filled so nothing typed is lost.

This is deliberately the opposite of the read rule. **Reads fall back to local;
writes do not.** Showing a stale row is harmless. Inventing a second record is
not.

## 3. When remote writes are permitted

Five conditions, all required:

| #   | Condition                                                | Checked where               |
| --- | -------------------------------------------------------- | --------------------------- |
| 1   | development mode (`NODE_ENV !== "production"`)           | `decidePartyApi`, via reads |
| 2   | loopback API URL                                         | `decidePartyApi`, via reads |
| 3   | `NEXT_PUBLIC_VYORA_API_PARTY_READS_ENABLED` is `"true"`  | `decidePartyApi`            |
| 4   | `NEXT_PUBLIC_VYORA_API_PARTY_WRITES_ENABLED` is `"true"` | `decidePartyWrites`         |
| 5   | `VYORA_API_DEV_IDENTITY` is set on the server            | `writeGate()` — server only |

`decidePartyWrites` **calls** `decidePartyApi` rather than repeating its checks.
That is why writes can never be broader than reads: every refusal reads can
produce, writes inherit, and the write flag can only narrow further. A build
where writes worked while reads did not would show a developer a screen that
disagrees with the change they just made — which is how someone concludes their
data is lost.

Condition 5 lives only on the server. The browser has no way to learn whether
an identity is configured, and giving it one would leak that a credential
exists.

**Production is refused by construction**, not by a second check someone could
forget to copy over.

## 4. The credential still never reaches the browser

Unchanged from the read slice, and re-proven for writes: the browser posts to
`/api/vyora-dev/parties`, and the Next route attaches `VYORA_API_DEV_IDENTITY`
server-side. No `NEXT_PUBLIC_` prefix, so Next never inlines it.

```
Browser ─POST/PATCH─► /api/vyora-dev/parties ─► http://127.0.0.1:4000/api/v1/parties
                       (Next route handler)      + x-vyora-dev-identity: <server-only>
```

The proxy forwards an **allow-list** of two headers — `Idempotency-Key` and
`If-Match` — and nothing else.

## 5. Surface

| Route                              | Verbs                            |
| ---------------------------------- | -------------------------------- |
| `/api/vyora-dev/parties`           | `GET` (list), `POST` (create)    |
| `/api/vyora-dev/parties/[partyId]` | `GET` (detail), `PATCH` (update) |

**No `DELETE`, no `PUT`, no sync.** Deletion is withheld because "party deleted
on one device while another records an entry" has no safe automatic answer
(`openapi-design.md` §6, deferred decision 1). `PUT` is withheld because nothing
here replaces a whole record. Both absences are asserted by test, so adding one
is a deliberate act rather than a drift.

`PartyWriter` exposes exactly `create` and `update`.

## 6. Concurrency

Handled exactly as the contract defines, and threaded rather than recomputed:

1. A read returns the party and its `ETag`.
2. `update()` sends that value as `If-Match`.
3. The API answers `200` with a **new** `ETag`, which becomes the next
   `If-Match`.
4. A stale value gets `412 VERSION_CONFLICT`; a missing one gets `428`.

The client never derives an ETag locally. If it did, a stale client could
overwrite a newer server record — precisely what optimistic concurrency exists
to prevent.

A conflict is surfaced **differently from an outage**, because they call for
different actions: an outage says "retry", a conflict says "re-read, then
re-apply". The server is never overwritten to resolve one.

## 7. Error behaviour

| Failure                    | What the developer sees                                                    | What is written               |
| -------------------------- | -------------------------------------------------------------------------- | ----------------------------- |
| API unreachable            | red notice, `DEPENDENCY_UNAVAILABLE`, "Nothing was written locally either" | **nothing, anywhere**         |
| Stale / missing `If-Match` | orange notice, "the server record is newer", advice to re-read             | **nothing**; server untouched |
| Validation error           | red notice carrying the server's own message and field details             | **nothing, anywhere**         |

Wording is technical and `DEV:`-prefixed. A merchant must never be shown "API
unavailable" about their own ledger: on the default path their write reached the
device and succeeded, and on the development path there is no merchant present.

The notice renders **nothing at all** on the default path, so the merchant's
screen is byte-identical to before this milestone.

## 8. What is deliberately absent

No entries, payments, recovery, closing, deletion, sync or cloud auth. No local
party-update command was added either — the local path reports that update is a
development-only API capability rather than inventing new local behaviour. This
milestone adds **no** new local write.

## 9. Enabling and disabling

```bash
# .env.local — never committed
NEXT_PUBLIC_VYORA_API_PARTY_READS_ENABLED=true    # required first
NEXT_PUBLIC_VYORA_API_PARTY_WRITES_ENABLED=true
NEXT_PUBLIC_VYORA_API_URL=http://127.0.0.1:4000
VYORA_API_DEV_IDENTITY=<a seeded fixture identity>
```

Restart `next dev` afterwards — `NEXT_PUBLIC_*` is read at build time.

**Use a fresh browser profile when toggling.** Vyora's service worker is scoped
to `/vyora/` and will serve a stale bundle after a flag change; the symptom
looks exactly like the flag being ignored. This cost real time in
VYORA-PLATFORM-007 and will do so again.

To disable: set both flags to `false`, or delete the lines, and restart. There
is nothing to unwind — no local data was ever written on the remote path.

**Never** give `VYORA_API_DEV_IDENTITY` a `NEXT_PUBLIC_` prefix. That publishes
the credential to every browser that loads the app.

## 10. Files

| File                                           | Role                                                                           |
| ---------------------------------------------- | ------------------------------------------------------------------------------ |
| `lib/vyora/party-api-config.ts`                | adds `decidePartyWrites` / `partyWriteDecision`                                |
| `lib/vyora/party-source.ts`                    | adds `PartyWriter`, `CreatePartyInput`, `UpdatePartyInput`, `PartyWriteResult` |
| `lib/vyora/party-source-remote.ts`             | adds `remotePartyWriter`                                                       |
| `app/api/vyora-dev/parties/forward.ts`         | adds `writeGate`, `forwardPartyWrite`, `WRITE_HEADERS`                         |
| `app/api/vyora-dev/parties/route.ts`           | adds `POST`                                                                    |
| `app/api/vyora-dev/parties/[partyId]/route.ts` | adds `PATCH`                                                                   |
| `features/vyora/usePartyWriter.ts`             | destination selection; **no fallback**                                         |
| `features/vyora/PartyWriteNotice.tsx`          | developer notice; renders nothing by default                                   |
| `features/vyora/screens/Parties.tsx`           | add-party form routes through the writer                                       |
