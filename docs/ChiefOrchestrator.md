# Chief Orchestrator / AIOS — moved to the platform (AIOS-005)

> **This document is a pointer.** The Chief Orchestrator (and all of AIOS) was **extracted out of this
> product repo** into the platform layer, per the CTO placement rule: _AIOS is platform infrastructure and
> must not live inside a product._

## Where AIOS lives now

`easytech-platform/packages/aios` — the package **`@easytech/aios`**.

- Developer docs: `easytech-platform/packages/aios/README.md`
- Design corpus (unchanged): `easytech-workspace/ProductFactory/Knowledge/AI/` (AIOS.md, AgentSDK.md,
  WorkflowEngine.md, CapabilityRegistry.md, TaskContract.md, ExecutionContract.md, StateMachine.md,
  EventBus.md, MemoryArchitecture.md, ApprovalMatrix.md, FailureRecovery.md, ProviderIntegration.md,
  ImplementationRoadmap.md).
- Migration record: `easytech-platform/packages/aios/MIGRATION.md` + ProductFactory sprint `AIOS-005`.

## Dependency direction (now correct)

```
easytech-platform (packages/aios = @easytech/aios)
        │  products consume AIOS; AIOS never depends on a product
        ▼
esytol (a consumer)
```

Previously AIOS was vendored inside `esytol/aios/`; that inverted the platform-first rule and is fixed.

## What changed in esytol (this sprint)

- `esytol/aios/` was **removed** (code, tests, developer README all relocated identically to the platform
  package — no functional, behavioral, interface, contract, registry, workflow, provider, or state-machine
  change).
- Esytol is now an **AIOS consumer**: it will `import { … } from "@easytech/aios"` when it wires the
  orchestrator into its runtime. That runtime integration is a **future** functional sprint — this
  extraction is refactoring only, so esytol carries no functional AIOS use today (exactly as before, when
  AIOS was inert to the site).
- The original implementation record for the Chief Orchestrator (AIOS-004) remains in the ProductFactory
  sprint history; its build details now live with the package at `packages/aios/README.md`.

_No behavioral change. Tests remain green (the 41 AIOS tests now run in `@easytech/aios`)._
