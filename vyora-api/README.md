# vyora-api

**Contract only. No implementation exists.**

```
vyora-api/
  openapi/openapi.yaml    ← the source of truth
  README.md               ← this file
```

## What may live here today

The OpenAPI contract and contract documentation. Nothing else.

**Explicitly not yet:** application source, `package.json`, lockfile, database migrations, Docker
configuration, generated client code. Those arrive in **Phase B** (`../docs/platform/migration-plan.md`),
and only after the contract is approved.

The directory is additive by design: deleting `vyora-api/` restores the repository exactly, and
`esytol`'s build, lockfile, CI and Vercel configuration never reference it (ADR-0001).

## The three rules this contract enforces

1. **Tenant scope comes from the token.** No path, query parameter, header or body property anywhere
   accepts a `merchantId`. Verified mechanically — `../docs/platform/auth-and-tenant-model.md` §5.
2. **`Party` is the only contact resource.** No customer or supplier entity, no role field
   (ADR-0002).
3. **Sync transfers events, never state.** Push appends; the server never overwrites (ADR-0003).

## Validating

```bash
npx @redocly/cli@latest lint vyora-api/openapi/openapi.yaml     # 0 errors, 0 warnings
npx @redocly/cli@latest bundle vyora-api/openapi/openapi.yaml   # all $refs resolve
```

## Design documents

| Document                                                                | Covers                                                                   |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [`openapi-design.md`](../docs/platform/openapi-design.md)               | endpoint and schema summary, conventions, deferred decisions             |
| [`auth-and-tenant-model.md`](../docs/platform/auth-and-tenant-model.md) | merchant/user/device, bearer scheme, development scheme, isolation proof |
| [`sync-protocol.md`](../docs/platform/sync-protocol.md)                 | push, pull, cursors, idempotency, rejection semantics                    |
| [`api-error-model.md`](../docs/platform/api-error-model.md)             | error envelope, codes, per-event rejection reasons                       |
