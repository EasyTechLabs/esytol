# Vyora Feature Modules

> **Status:** ⚠️ Partially implemented (ARCH-005) — 3 of 8 requested modules registered ·
> **No storage format change, no data migration** · **Last Updated:** 2026-08-01

- **Contract:** [`features/vyora/modules/types.ts`](../features/vyora/modules/types.ts)
- **Registry:** [`features/vyora/modules/index.ts`](../features/vyora/modules/index.ts)
- **Tests:** [`tests/vyora/modules.test.ts`](../tests/vyora/modules.test.ts)
- **Builds on:** [Workflows](VyoraWorkflows.md) → [Commands](VyoraCommandEngine.md) →
  [Event Log](VyoraEventLog.md) → [Ledger Engine](VyoraLedgerEngine.md)

---

## 1. What a module is

A **manifest of ownership**: which routes, commands, selectors and components belong to one feature.
The core reads the manifest and nothing else — it never imports a module file and contains no
`if (module === "contacts")`.

```ts
export const contactsModule: FeatureModule = {
  id: "contacts",
  title: "Contacts",
  summary: "Find anyone and read their full statement.",
  routes: [{ path: "/vyora/parties", label: "Parties", nav: true, icon: "👥" }],
  commands: ["CreateContact", "DeleteContact"],
  selectors: ["readSearch", "readParty", "readPartyNet", "readStatement"],
  components: ["Parties", "PartyStatement", "PartyPicker"],
};
```

**What this is not: a runtime plugin loader.** Next.js App Router routes are filesystem-defined, so a
module cannot conjure a route at runtime. Being honest about that is what keeps the design useful
rather than ceremonial. What the manifest _can_ be is the single answer to "who owns this?", which
is what lets the boundary be **tested** instead of merely intended:

| Guarantee                                                      | Test                                                                    |
| -------------------------------------------------------------- | ----------------------------------------------------------------------- |
| every engine command is owned by exactly one module or by core | reads the `Command` union out of `commands.ts` and checks the partition |
| no two modules claim the same command                          | set comparison over all claims                                          |
| every declared route has a real page file                      | `existsSync` against `app/**/page.tsx`                                  |
| the shell imports the registry, never a module                 | reads `AppShell.tsx` source                                             |
| the shell names no module                                      | reads `AppShell.tsx` source                                             |
| modules do not import each other                               | reads every module file                                                 |

`selectors` and `components` are declared **by name**. The registry does not invoke them — callers
import the typed function directly — it records that they belong to this feature, so a stray
cross-module reference is visible instead of silent.

## 2. Core knows nothing — made real

The bottom navigation is assembled from manifests:

```tsx
{navRoutes().map((route) => <NavIcon key={route.path} href={route.path} ... />)}
```

A new module appears in the nav by being added to `MODULES`. The shell is not edited. That is the
one place this milestone converts the idea into behaviour rather than documentation.

**Core is not a module.** Recording a credit or payment, correcting a mistake and putting it back is
what Vyora _is_ — it cannot be unplugged. `CORE_COMMANDS` and `CORE_ROUTES` list it explicitly so
the ownership map stays total.

## 3. Registered modules

| Module       | Routes                                  | Commands                         | State                             |
| ------------ | --------------------------------------- | -------------------------------- | --------------------------------- |
| **Contacts** | `/vyora/parties`, `/vyora/parties/[id]` | `CreateContact`, `DeleteContact` | ✅ complete                       |
| **Import**   | —                                       | `ImportLedger`                   | ⚠️ command + workflow only, no UI |
| **Backup**   | —                                       | `BackupLedger`, `ExportLedger`   | ⚠️ command + workflow only, no UI |

## 4. Not registered, and why

| Requested    | Why not                                                                                                                                                                                   |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Recovery** | Epic A (aging + relationship-safe follow-up). Not built. Registering an empty manifest would claim a feature that does not exist. `DueIndex` (ARCH-001) is the primitive it will own.     |
| **Insights** | Epic B. Not built — and `ProgramPlan.md` puts a _BI/analytics suite_ on the hard-OUT list, so this module must be scoped to the single cash-flow decision surface, not a dashboard suite. |
| **Settings** | Documented as shipped in Alpha v0.2; **absent from the code** — see §6.                                                                                                                   |
| **Founder**  | Documented as shipped in Alpha v0.2; **absent from the code** — see §6.                                                                                                                   |
| **Demo**     | No definition exists in any repository. I will not invent one.                                                                                                                            |

## 5. Preparing OCR, AI, Cloud Sync, WhatsApp

These are **deliberately documented, not coded.** All four are on `ProgramPlan.md`'s OUT or
evidence-gated list, and a plug point designed without the feature is almost always the wrong shape.
What genuinely prepares for them is the architecture already built — each has a named seam:

| Capability     | Seam it would use                                                                                                             | Status in the plan                                          |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **OCR**        | a new command (`RecordCreditFromImage`) emitting the existing `CreditRecorded` event — no schema change                       | ❌ hard-OUT                                                 |
| **AI**         | same: a command that proposes, a merchant that confirms; the engine validates as usual                                        | ❌ hard-OUT                                                 |
| **Cloud sync** | the event log (ARCH-002). Append-only events converge; mutable state cannot. Needs per-device identity, which does not exist. | 🔬 evidence-gated spike                                     |
| **WhatsApp**   | a module owning a share command; reminders stay **merchant-sent** via `navigator.share` — never a server                      | ⛔ network features are OUT; merchant-sent share is Epic A2 |

The useful claim is narrow and true: **none of these would require changing the ledger, the event
log, or the command contract.** That is the preparation. Building empty adapters for them would not
add to it.

## 6. ⚠️ The documentation does not match the code

Found while scoping this milestone, and larger than the milestone itself.

`vyora/alpha/ReleaseNotes.md` describes Alpha **v0.2 as shipped** with:

- Export / Import + Backup / Restore + a backup reminder
- session **Undo** on credit, payment and delete
- **Founder Mode** — hidden diagnostics (tap the "Alpha" badge 5×): totals, storage size, schema
  version, export counts
- a **Settings** screen (Export data, Clear all data)
- terminology unified to **"Contacts"**

**None of it exists in `esytol`.** There are five routes (`/vyora`, `/credit`, `/payment`,
`/parties`, `/parties/[id]`), no Settings screen, no Founder Mode, no export/import/backup UI, no
undo affordance, and zero occurrences of "Contacts" in the feature code.

This is not cosmetic. `pilot/PilotChecklist.md` instructs the operator to use _Settings → Export_ and
_Settings → Clear all data_; `pilot/MetricsTracker.md` sources **eight of the pilot's metrics from
Founder Mode**. As things stand, **the pilot as documented cannot be run against the deployed app.**

Nothing in this milestone fixes that — it is a scoping decision, not an engineering one.
