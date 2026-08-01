# Bug Report

> One file per bug. Copy the template. File it the **same day** — details decay overnight.
> If a merchant believes data was lost, **export their ledger before anything else** and attach it.

---

## Template

**ID:** BUG-___
**Date:** YYYY-MM-DD
**Merchant:** (name / pilot number)
**Reported by:** merchant / founder observation

**Device:** (e.g. Redmi Note 12, Android 13)
**Browser:** (Chrome 120 / Safari 17 / installed app)
**Installed as app:** Yes / No — _(Settings → App installed)_
**App version:** _(Settings → Version)_
**Service worker:** _(Settings → Service worker)_
**Offline at the time:** Yes / No / Unknown

**Steps to reproduce** 1. 2. 3.

**Expected**

**Actual**

**Reproducible:** Always / Sometimes / Once only / Not tried again
_(If you could not reproduce it, say so. A one-off is still worth filing.)_

**Severity:** Critical / High / Medium / Low — see the scale below

**Screenshot:** attached / none

**Founder Mode readings** _(tap "Alpha" ×5 — take these BEFORE changing anything)_

- Contacts / Credits / Payments / Entries:
- Events in log:
- Receivable / Payable / Net:
- Storage used:
- **Integrity:** all passed / **FAILED —** which check:

**Ledger export attached:** Yes / No
_(Mandatory for anything Critical or High, and for any wrong number.)_

**Merchant's own words**

> "…"

**Workaround given to the merchant**

**Status:** Open / Investigating / Fixed / Won't fix / Cannot reproduce
**Owner:**

---

## Severity scale

| Level        | Meaning                                                 | Examples                                                                              |
| ------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **Critical** | Data lost, a balance is wrong, or the app will not open | Entries missing after reopening; receivable does not match the notebook; blank screen |
| **High**     | A core job cannot be completed                          | Cannot record a credit; Chase empty when money is owed; export produces nothing       |
| **Medium**   | Works, but wrong or confusing                           | Wrong wording; a number reads oddly; an action needs an extra tap                     |
| **Low**      | Cosmetic                                                | Spacing, alignment, colour                                                            |

**Any Critical bug stops that merchant's pilot** until it is understood. Export their ledger, put
them back on their notebook, and tell them plainly what happened.

---

## Filed bugs

| ID  | Date | Merchant | Summary | Severity | Status | Owner |
| --- | ---- | -------- | ------- | -------- | ------ | ----- |
|     |      |          |         |          |        |       |
