# Vyora 1.0.0-rc1 — Pilot Guide

> Covers the **Merchant Quick Start** and the **Founder Checklist**. Run the Founder Checklist on a
> real phone before onboarding anyone — RC1 has never been device-verified (see ReleaseNotes §6).

---

## 1. Merchant quick start — what to show, in order

Keep it under five minutes. Do not explain features; watch them use it.

1. **Open** `esytol.com/vyora` → tap **Install Vyora** → the icon appears with their apps.
   _(iPhone: Share → Add to Home Screen.)_
2. **Record one real credit.** Amount → name (typing creates the customer) → tap **30 days**.
   Point out the line that says _"Due 31 Aug · Sunday"_ — that is the whole due-date feature.
3. **Record a payment** against the same person. Show the balance move on Home.
4. **Open Chase.** The person at the top is who to call first. Tap **What to say** → **Share**.
   Say plainly: _Vyora never sends anything. You send it._
5. **Open More → Settings → Export ledger.** Their book becomes a file on their phone.
   Say plainly: _This is yours. Nothing leaves this phone._
6. **Show More → Closing** and tell them to open it at the end of the day.

**What to say about privacy, in their words:** _"Everything stays on this phone. No account, no
internet needed, nobody else can see it — including us."_ This is true and is the product's main
differentiator against a notebook and against Khatabook.

## 2. Founder checklist — before each merchant

Run this on the merchant's own phone, not yours.

- [ ] Open `/vyora` — loads without error
- [ ] Install banner appears → install → icon on home screen with the **Vyora** mark _(fails today —
      iOS shows esytol's icon, see ReleaseNotes B2)_
- [ ] Reopen from the icon — no browser address bar
- [ ] Record a credit with a due date → appears on Home and in Chase
- [ ] Record a payment → balance updates
- [ ] Chase shows the right person first, with a phone number
- [ ] "What to say" produces a message you would be happy to send to a customer you cannot lose
- [ ] Share opens the phone's own share sheet
- [ ] Long-press a contact → sheet with Call / WhatsApp / Credit / Payment / Statement / Delete
- [ ] Settings → **Export ledger** downloads a file
- [ ] Airplane mode → close → reopen from icon → **app still opens and the book is intact**
- [ ] Settings shows **App installed: Yes**, **Offline ready: Yes**, version **1.0.0-rc1**
- [ ] Founder Mode opens (tap "Alpha" ×5) and integrity reports all checks passed

**Stop the onboarding if:** the app does not open offline, any balance looks wrong, or export
produces nothing. Those are the three things the pilot exists to test.

## 3. During the pilot — reading the numbers

`pilot/MetricsTracker.md` sources eight metrics from **Founder Mode** (tap "Alpha" ×5). It reports
contacts, credits, payments, entries, events in log, receivable, payable, net, storage used, last
backup, imports and deletions — plus integrity checks and a performance timeline.

Founder Mode records nothing and sends nothing. Diagnostics are enabled only while the screen is
open and the buffer is cleared when you leave it.

## 4. Backup procedure

**Ask every merchant to export on day 1 and then weekly.**

1. More → Settings → **Export ledger** → a `vyora-YYYY-MM-DD.json` file saves to the phone.
2. Tell them to forward it to themselves on WhatsApp — that is a real, understandable off-device copy.
3. The **Data safety** card at the top of Settings is the honest status. It goes amber the moment any
   entry is recorded after the last backup, and names how many entries would be lost.

Vyora will nudge on the schedule the merchant picks (Daily / Weekly / Never).

## 5. Restore procedure

1. More → Settings → **Restore from backup** → choose the file.
2. Vyora shows **exactly what the file contains** — contacts, credits, payments — and what will be
   replaced, before anything changes.
3. Confirm. Restore replaces the whole ledger; it does not merge.

**Before restoring on a phone that has data, export that phone first.** Restore is not undoable.

The business profile, favourites, recents and day notes are device preferences and are **not** in the
file — the merchant will need to re-enter a shop name after restoring to a new phone.

## 6. Rollback procedure

If RC1 misbehaves in the field:

1. **Revert the deploy** — redeploy the previous commit on Vercel. Vyora's data is local, so
   rolling back the code does not touch any merchant's book.
2. **Merchants keep running the cached build until they accept an update.** The service worker never
   refreshes anyone automatically, so a rollback reaches them on their next accepted update, not
   instantly. To force it, bump `SW_VERSION` on the rolled-back build.
3. **Data is safe across a rollback** provided the log format did not change. RC1 is log format
   **v2**; do not roll back to a build older than ARCH-002, which cannot read v2 and will show an
   empty ledger. If that ever happens, the merchant's `vyora.alpha.v1` key is still present and the
   exported file is the recovery path.
4. **Individual merchant recovery:** Settings → Restore from their most recent export.

## 7. What to tell a merchant if something goes wrong

- _"Nothing was saved"_ message → their phone is out of space. Export first, then delete old photos.
- App will not open offline → they have not installed it yet, or never opened it online first.
- Numbers look wrong → open Founder Mode, run integrity checks, and send us what it says.
- Anything else → **export the ledger and send us the file** before changing anything.
