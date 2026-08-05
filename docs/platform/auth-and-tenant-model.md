# Authentication and Tenant Model

> Design only. Settles founder open question #1 from `domain-model.md` §7.
> Contract: `vyora-api/openapi/openapi.yaml`.

---

## 1. The tenant

A **Merchant** is a **server-owned workspace** with a UUID `merchantId`. It is the boundary for
every query, every event and every projection. There is no cross-merchant read path anywhere in the
system, by design and by contract.

```
Merchant (workspace, server-owned UUID)
  ├── User    — who signs in.   Today exactly one, role `owner`.
  └── Device  — where events originate. Many per merchant.
```

**Users and devices belong to a workspace.** Multi-user access is a later capability. The `role`
field exists now with a single value so adding a second is additive rather than breaking.

## 2. The one rule everything else follows from

> **Merchant scope is resolved from the access token. It is never read from the request.**

Clients do not send, select, override, or even know how to name a `merchantId` until `GET /me` tells
them. There is no path segment, query parameter, header or body property in the entire contract
through which a caller could name a workspace.

This is stronger than checking authorisation on every handler. A missing check is a vulnerability; a
missing _field_ is not exploitable at all. There is no crafted request that reaches the wrong
workspace, because there is no request shape that mentions one.

**`deviceId` is an identifier, not a credential.** It appears in `POST /sync/push` and
`GET /sync/pull` for cursor bookkeeping and diagnostics. Knowing one grants nothing — the token
still decides the workspace, and a `deviceId` belonging to another merchant simply matches no events
in the caller's scope.

## 3. Production scheme — `bearerAuth`

HTTP bearer, JWT. The token carries merchant, user and device. Applied globally; only `/health`
opts out with `security: []`.

Claims the token must carry, and what each is for:

| Claim         | Purpose                                     |
| ------------- | ------------------------------------------- |
| `sub`         | user id                                     |
| `mid`         | merchant workspace id — the tenant scope    |
| `did`         | device id                                   |
| `exp`         | expiry; expired tokens fail `TOKEN_EXPIRED` |
| `iss` / `aud` | issuer and audience pinning                 |

**The identity provider is deliberately unchosen.** The contract depends only on "a validated bearer
token resolves to a workspace". Any provider satisfying that fits without a contract change, so
picking one now would be a guess with no evidence behind it (deferred decision #4).

## 4. Development scheme — `devAuth`, and how it is fenced off

Contract testing needs a caller identity before an identity provider exists. That need is real, and
the honest way to meet it is an explicit, separate scheme rather than a magic bearer value.

```
X-Vyora-Dev-Identity: <fixture-workspace-name>
```

Five independent constraints keep it out of production:

1. **It is a different scheme.** `apiKey` in a distinct header, not a bearer token. Accepting it is
   one explicit branch in one place — greppable, testable, and impossible to reach by accident from
   the production auth path.
2. **It requires `VYORA_DEV_AUTH=true`.** Absent the flag, the header is ignored entirely.
3. **The flag is refused when `NODE_ENV=production`.** The process must fail to boot, not warn.
   A warning is a thing people stop reading.
4. **It resolves only to fixture workspaces.** The value names a seeded synthetic merchant from the
   local fixture set. There is no lookup path from this header to a real merchant record, so even if
   every other control failed it could not reach real data.
5. **The server discloses it.** `GET /me` returns `authMode: "development"`, so a client can refuse
   to render real-looking data in a test build instead of quietly showing fixtures as if they were
   the merchant's own book.

**This must never become a production bypass.** Controls 3 and 4 are the ones that make that
structurally true rather than merely intended: one prevents the flag from existing in production,
the other prevents the scheme from addressing real data even if it did.

> Recommended for Phase B: an integration test that boots the server with `NODE_ENV=production` and
> `VYORA_DEV_AUTH=true` and asserts it **exits non-zero**. A control nobody tests is a control
> nobody has.

## 5. Tenant isolation proof

Eleven assertions were run over the parsed, fully dereferenced contract — following every `$ref`, so
a `merchantId` hidden three schemas deep would still be found. All pass.

```
Operations: 8
PASS  no request parameter, path template, or body property named merchantId
PASS  merchantId appears in responses only on: GET /api/v1/me 200
PASS  no Customer/Supplier schema and no /customers or /suppliers path
PASS  no role/type field on any party schema
      (checked: PartyRef, PartyPosition, Party, PartyBalance, PartyPage, PartyRecord)
PASS  /api/v1/sync/push: events=true bare-state=false
PASS  /api/v1/sync/pull: events=true bare-state=false
PASS  SNAPSHOT_EVENT_UNSUPPORTED is an explicit per-event rejection reason
PASS  every 4xx/5xx on every operation returns the standard error envelope
PASS  X-Request-Id declared on every response of every operation
PASS  Idempotency-Key required on every POST/PATCH
PASS  surface matches the specified 8 endpoints exactly
```

The check matched `/^merchant(_?id)?$/i` against every request parameter name, every path template,
and every property name reachable in any request body — including inside `oneOf` branches and
`allOf` compositions.

**What this proves:** no request in this contract can carry a tenant selector.
**What it does not prove:** that a future implementation scopes its queries correctly. That is an
implementation obligation for Phase B, and it needs its own cross-tenant integration test — two
seeded workspaces, then assert that every endpoint returns `404` or an empty page for the other's
data. This audit removes the _request-shaped_ attack surface; it cannot remove a missing `WHERE`
clause.

## 6. Read-path scoping rules for Phase B

1. Every query filters by the token's `merchantId`. No exceptions, including admin and debug paths.
2. A resource in another workspace returns `404`, never `403` — `403` confirms existence.
3. `GET /sync/pull` returns only events in the caller's workspace, and by default excludes the
   caller's own `deviceId`.
4. Projections are keyed by `merchantId` and rebuilt per workspace. A rebuild for one merchant can
   never read another's events.
5. `Idempotency-Key` uniqueness is scoped **per merchant**. Global scoping would leak the existence
   of another merchant's request through a collision.

Rule 5 is the one most likely to be missed, because a global unique index on the key looks correct
until two workspaces generate the same UUID — rare, but a cross-tenant information leak when it
happens.

## 7. What is deferred

| Item                       | Status                                    | Gate        |
| -------------------------- | ----------------------------------------- | ----------- |
| Identity provider choice   | not chosen; contract is provider-agnostic | Phase E     |
| Merchant onboarding flow   | no create-merchant endpoint exists        | Phase E     |
| Multi-user workspaces      | modelled (`user.role`), not implemented   | after pilot |
| Token refresh / revocation | not designed                              | Phase E     |
| Device de-registration     | not designed; devices are additive today  | Phase D     |
