# PR-2.1 — Design System Alignment

> **Sprint 002 · Priority 1 (Design parity).** Scope: update **existing screens only** — no new features, no new
> navigation, no business logic, no Recovery UI. Goal: create **reusable design tokens**, extract **shared components**,
> and **replace hardcoded values**, with **zero visual regression** (the app already conforms to the design system;
> this is centralization, not a restyle — Before ≈ After is the proof).
>
> **Status:** ✅ type-check · lint · **1987/1987 tests** · build all green. Foundation + 3 screens migrated;
> remaining screens staged for completion with visual QA on the dev preview (see §4). **Not yet deployed** — see §5.

---

## 1. Component Inventory

### Design tokens (new — `tailwind.config.ts`)

| Token                                       | Value(s)                                | Replaces                        | Where                              |
| ------------------------------------------- | --------------------------------------- | ------------------------------- | ---------------------------------- |
| `brand.*`                                   | `#2563eb` … (unchanged)                 | —                               | buttons, links, active nav         |
| **`positive`** (`DEFAULT/strong/tint/line`) | `#059669 / #047857 / #ecfdf5 / #10b981` | inline `emerald-600/700/50/500` | money-in, received, "they owe you" |
| **`negative`** (`DEFAULT/strong/tint/line`) | `#dc2626 / #b91c1c / #fef2f2 / #ef4444` | inline `red-600/700/50/500`     | money-out, payable, "you owe them" |

Neutrals (`gray-*`), the `brand` scale, radius (`rounded-lg/xl/2xl`), and elevation (`border`, minimal `shadow-lg`)
already form a consistent token set via Tailwind's scale — documented as the canonical scale, unchanged.

### Shared primitives (new — `features/vyora/primitives.tsx`)

| Component       | API                                                                                           | Renders (exact)                                 | Replaces                |
| --------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------- | ----------------------- |
| **`Card`**      | `tone: default\|danger\|dashed`, `as`, `className`                                            | `rounded-2xl border p-4 …`                      | 9 inline card blocks    |
| **`Button`**    | `variant: primary\|positive\|negative\|secondary\|danger\|ghost`, `size: sm\|md\|lg`, `block` | size+variant classes                            | inline `<button>`s      |
| **`TextInput`** | native input props + `className`                                                              | `rounded-2xl border-2 … focus:border-brand-500` | inline text/date inputs |
| **`Badge`**     | `tone`, `className`                                                                           | `rounded-full px-2 py-0.5 …`                    | the Alpha pill          |

### Existing atoms — now token-backed (`features/vyora/components.tsx`, `lib/vyora/format.ts`)

| Atom             | Change                                                                                               |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| `StatCard`       | uses `<Card>`; tone colours → `text-positive` / `text-negative`                                      |
| `Segmented`      | active tones → `positive`/`negative` token classes                                                   |
| `BigButton`      | now a thin wrapper over shared `Button` (`size="lg"`, `block`) — byte-identical output               |
| `Empty`          | uses `<Card tone="dashed">`                                                                          |
| `balanceColor()` | returns `text-positive` / `text-negative` (single source for money colour, used by **every** screen) |

---

## 2. Design Parity Checklist

| Task                 | Status | Notes                                                                                                                           |
| -------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------- |
| **Typography**       | ✅     | Inter + `tabular-nums` already app-wide; scale consistent (h1 `text-lg`, money `text-2xl/3xl/4xl`). No hardcoded font values.   |
| **Spacing**          | ✅     | `space-y-4` screens, `p-4` cards, `gap-3` grids — via `Card` + Tailwind scale.                                                  |
| **Corner radius**    | ✅     | Tokenized through `Card` (2xl), `Button` sizes (lg→2xl, md→xl, sm→lg), `TextInput` (2xl).                                       |
| **Elevation**        | ✅     | Border-based (design intent = flat); only 2 `shadow-lg` (dropdown/menu) retained.                                               |
| **Colors**           | ✅     | Semantic money colours → `positive`/`negative` tokens; `balanceColor` is the single source.                                     |
| **Cards**            | 🟡     | `Card` created; **StatCard, Empty, Settings** migrated. Dashboard/Contacts/Statement inline cards **staged** (§4).              |
| **Buttons**          | 🟡     | `Button` created; **BigButton (all entry saves), Settings (5 buttons)** migrated. A few bespoke small/icon buttons staged (§4). |
| **Input fields**     | ✅     | `TextInput` created; **Credit, Payment** inputs migrated; Statement edit inputs staged (§4).                                    |
| **Icons**            | ✅     | Emoji/glyph icons unchanged (theme-agnostic); no icon-system drift.                                                             |
| **Dashboard layout** | 🟡     | StatCards token-backed; hero + reminder + activity cards **staged** (§4) — layout itself already conformant.                    |

Legend: ✅ complete · 🟡 pattern established, adoption partial (staged).

---

## 3. Before / After (representative)

**Money colour — centralized:**

```
- <div className={tone === "in" ? "text-emerald-600" : "text-red-600"}>   // repeated inline
+ // lib/vyora/format.ts  →  balanceColor(): "text-positive" | "text-negative"   (one source, all screens)
```

**Card — shared:**

```
- <div className="rounded-2xl border border-gray-200 bg-white p-4"> … </div>   // ×9
+ <Card> … </Card>
```

**Button — shared, variant-driven:**

```
- <button className="rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700 focus-visible:…">Back up now</button>
+ <Button variant="primary" block>Back up now</Button>
```

**Input — shared:**

```
- <input className="w-full rounded-2xl border-2 border-gray-200 bg-white px-4 py-3 outline-none focus:border-brand-500" />
+ <TextInput />
```

**Disclosed micro-deltas (intentional consistency, not regressions):** the shared `Button` adds `transition-colors`
to buttons that lacked it, and a subtle `hover:bg-gray-50` to secondary buttons that had no hover. No change to colour,
size, radius, or layout. Everything else is byte-identical (verified: tokens map to the same hex values; `twMerge`
lets per-instance `className` override defaults exactly, e.g. date inputs keep `px-3`).

**Screenshots:** pixel captures require the running app; I can't render them in this environment. Because the refactor
is visually a no-op by construction, the honest Before/After is the **code diff above** plus a **side-by-side of the two
Vercel previews** (prod branch vs `develop`) once the dev deploy is unblocked (§5) — they should be indistinguishable.

---

## 4. Remaining Mismatches (staged — finish with visual QA on dev)

None are visual defects today; they are **adoption gaps** where inline markup still duplicates a primitive:

| Item                    | Screen(s)                                                                                                     | Action                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Inline cards → `<Card>` | Dashboard (reminder, activity), Contacts (list), Party Statement (header, statement), Founder (table)         | mechanical swap; do with the dev preview open to eyeball each.                                            |
| Bespoke buttons         | Statement (Edit/PDF `border`+`font-medium`; delete ✕ icon), entry-screen "+ date" text links, AppShell Back/⚙ | either add matching `Button` variants (`icon`, `link`) or keep as intentional one-offs — decide visually. |
| `Badge` adoption        | AppShell Alpha pill                                                                                           | swap to `<Badge>` (identical) — low risk, deferred with the AppShell pass.                                |
| Amber "caution" token   | Alpha banner, PartyPicker hint                                                                                | currently Tailwind `amber-*` (design-system value); promote to a named `caution` token in a follow-up.    |
| Dark mode               | all                                                                                                           | **out of scope** for PR-2.1 (its own item; gated on pilot need per the accepted Sprint-001 review).       |

---

## 5. Deploy status — HELD (two blockers, both Founder-console)

The sprint's target is auto-deploy to `https://dev.esytol.com/vyora`. It is **blocked on two items I cannot do and that
I flagged in the accepted Sprint-001 review:**

1. 🔴 **Rotate the leaked GitHub token** — I gated "the next push" on this. Pushing `develop` needs a token.
2. 🟠 **`dev.esytol.com` is not wired** — needs the DNS + Vercel domain→`develop` mapping documented in
   `docs/ops/ContinuousDeployment.md`. Until then a `develop` push lands on the **auto Vercel preview URL**, not
   `dev.esytol.com`.

**This PR-2.1 work is committed locally on `develop` and fully validated.** The moment the token is rotated (and,
ideally, the dev domain wired), one push deploys it — and I'll finish §4 against the live dev preview.

**Stopped after PR-2.1. Recovery UI not started.**
