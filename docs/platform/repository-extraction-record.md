# Repository Extraction Record — ARCH-003

> The audit trail for splitting the Vyora platform out of `esytol` into
> dedicated repositories. Written so the split is reversible and so a future
> reader can tell exactly which file went where, and why.

---

## 1. Preservation — done before anything was changed

Nothing was extracted, moved or deleted until the state below existed **on the
remote** and was verified by reading it back from the GitHub API.

|                     |                                                |
| ------------------- | ---------------------------------------------- |
| Source repository   | `EasyTechLabs/esytol`                          |
| Source branch       | `develop`                                      |
| **Source commit**   | **`b9954e73480218962988d86450d0041668921c52`** |
| Preservation branch | `wip/vyora-platform-015-preserved`             |
| Annotated tag       | `backup/vyora-platform-015-before-extraction`  |

Verification, read back from the API rather than assumed from a successful push:

```
BRANCH  200  sha b9954e73480218962988d86450d0041668921c52
TAG     200  annotated object e291a8c6… → commit b9954e73…
        present  vyora-api/openapi/openapi.yaml
        present  vyora-mobile/package.json
        present  docs/platform/PROJECT_CONTEXT.md
```

A push reporting success and a remote actually holding the objects are different
claims. The second is the one that matters before a destructive step, so it is
the one that was checked.

**Recovery from this point:**

```bash
git fetch origin
git checkout -b recover backup/vyora-platform-015-before-extraction
```

That restores the complete pre-extraction tree — web, API and mobile together —
exactly as validated at the end of VYORA-PLATFORM-015.

### Pushing this branch triggers a Vercel Preview

Expected and accepted. It is a non-`main` branch, so it cannot reach production.
The Preview must not be merged and nothing is to be deployed from it.

---

## 2. What was validated at the preserved commit

| Suite                         | Result                                             |
| ----------------------------- | -------------------------------------------------- |
| API                           | 8 files / 121 tests passed                         |
| API contract lint             | 0 errors, 0 warnings; bundle resolves every `$ref` |
| Web                           | 130 files / 2490 tests passed                      |
| Web production build          | 142/142 pages, exit 0                              |
| Mobile                        | 27 tests passed against real SQLite                |
| E2E web → API → PostgreSQL    | 20/20 checks                                       |
| E2E mobile → API → PostgreSQL | 3/3 cases                                          |
| Android debug APK             | BUILD SUCCESSFUL, 56.2 MB, `arm64-v8a`             |

---

## 3. File inventory at the preserved commit

834 tracked files in total. The extraction concerns 88 of them.

### vyora-api — 39 tracked files

```
vyora-api/.env.example
vyora-api/.gitignore
vyora-api/README.md
vyora-api/migrations/001_init.sql
vyora-api/migrations/002_entry_statement_fields.sql
vyora-api/openapi/openapi.yaml
vyora-api/package-lock.json
vyora-api/package.json
vyora-api/postcss.config.mjs
vyora-api/src/auth/index.ts
vyora-api/src/config.ts
vyora-api/src/contract.ts
vyora-api/src/db/migrate.ts
vyora-api/src/db/pool.ts
vyora-api/src/errors.ts
vyora-api/src/events/apply.ts
vyora-api/src/idempotency.ts
vyora-api/src/index.ts
vyora-api/src/main-module.ts
vyora-api/src/modules/ledger/repository.ts
vyora-api/src/modules/ledger/routes.ts
vyora-api/src/modules/parties/repository.ts
vyora-api/src/modules/parties/routes.ts
vyora-api/src/modules/sync/cursor.ts
vyora-api/src/modules/sync/routes.ts
vyora-api/src/modules/system/routes.ts
vyora-api/src/seed/seed.ts
vyora-api/src/server.ts
vyora-api/tests/contract.test.ts
vyora-api/tests/helpers.ts
vyora-api/tests/ledger-payments.test.ts
vyora-api/tests/ledger.test.ts
vyora-api/tests/migrations.test.ts
vyora-api/tests/parties.test.ts
vyora-api/tests/startup-and-health.test.ts
vyora-api/tests/sync.test.ts
vyora-api/tests/tenant-isolation.test.ts
vyora-api/tsconfig.json
vyora-api/vitest.config.ts
```

### vyora-mobile — 39 tracked files

```
vyora-mobile/.gitignore
vyora-mobile/App.tsx
vyora-mobile/app.json
vyora-mobile/assets/android-icon-background.png
vyora-mobile/assets/android-icon-foreground.png
vyora-mobile/assets/android-icon-monochrome.png
vyora-mobile/assets/favicon.png
vyora-mobile/assets/icon.png
vyora-mobile/assets/splash-icon.png
vyora-mobile/index.ts
vyora-mobile/package-lock.json
vyora-mobile/package.json
vyora-mobile/scripts/generate-api-types.mjs
vyora-mobile/src/api/client.ts
vyora-mobile/src/api/config.ts
vyora-mobile/src/api/contract.generated.ts
vyora-mobile/src/components/index.tsx
vyora-mobile/src/database/driver.ts
vyora-mobile/src/database/migrate.ts
vyora-mobile/src/database/repository.ts
vyora-mobile/src/database/schema.ts
vyora-mobile/src/features/ledger.ts
vyora-mobile/src/navigation/index.tsx
vyora-mobile/src/screens/PartyDetailScreen.tsx
vyora-mobile/src/screens/PartyListScreen.tsx
vyora-mobile/src/screens/RecordCreditScreen.tsx
vyora-mobile/src/screens/RecordPaymentScreen.tsx
vyora-mobile/src/screens/SetupScreen.tsx
vyora-mobile/src/screens/SyncStatusScreen.tsx
vyora-mobile/src/store/AppProvider.tsx
vyora-mobile/src/store/settings.ts
vyora-mobile/src/sync/engine.ts
vyora-mobile/src/sync/outbox.ts
vyora-mobile/src/theme/index.ts
vyora-mobile/tests/api-client.test.ts
vyora-mobile/tests/helpers.ts
vyora-mobile/tests/live-api.test.ts
vyora-mobile/tests/offline-first.test.ts
vyora-mobile/tsconfig.json
```

### Web files that stay in `esytol`

These are the **development-only web adapter**. They are the web app's client
side of the boundary, not API implementation, so they remain here:

```
app/api/vyora-dev/parties/route.ts
app/api/vyora-dev/parties/forward.ts
app/api/vyora-dev/parties/[partyId]/route.ts
app/api/vyora-dev/parties/[partyId]/credits/route.ts
app/api/vyora-dev/parties/[partyId]/payments/route.ts
app/api/vyora-dev/parties/[partyId]/statement/route.ts
app/api/vyora-dev/parties/[partyId]/summary/route.ts
lib/vyora/party-api-config.ts        flag gates
lib/vyora/party-source-remote.ts     party adapter
lib/vyora/ledger-source.ts           ledger adapter
```

`forward.ts` holds `VYORA_API_DEV_IDENTITY` server-side. That is why the proxy
exists at all: a credential in browser JavaScript is a credential you have
published.

### Ownership rule applied

| Goes to `vyora-api`  | Stays in `esytol`                 | Goes to `vyora-mobile`      |
| -------------------- | --------------------------------- | --------------------------- |
| OpenAPI contract     | Vyora web pages and hooks         | Expo/React Native source    |
| Fastify source       | `/api/vyora-dev/*` proxy routes   | Android + iOS configuration |
| Migrations and seeds | Flag gates and adapters           | SQLite, outbox, sync        |
| API tests            | Web tests                         | Mobile tests                |
| `api-ci.yml`         | `ci.yml`, `deploy-production.yml` | Mobile CI                   |
| API docs             | Web/platform docs                 | Build instructions          |

**No Esytol web code goes into either new repository, and no API server code
stays in Esytol.** The mobile repository gets a _generated_ copy of the contract
types, not the contract's implementation.
