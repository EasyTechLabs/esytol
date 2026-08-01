# Rollback Guide

> When something goes wrong in the field. Read the first section before you touch anything.

---

## Rule zero — export before you act

**Whatever has gone wrong, take the merchant's export first.**

More → Settings → **Export ledger** → send the file to yourself on WhatsApp.

Their data lives only on that phone. Every recovery path below starts from a file you already hold.
If you cannot export because the app will not open, go to §4 before doing anything else.

## 1. One merchant has a problem

**Their data is intact and the app works** → file it in `BugReport.md`, give them a workaround,
carry on.

**A balance looks wrong**

1. Export.
2. Open **Founder Mode** (tap "Alpha" ×5) → run **integrity checks**.
3. If any check failed: send engineering the export and the failing check name. **Stop that
   merchant's pilot** and put them back on their notebook that day.
4. If all checks passed, the ledger is self-consistent — the difference is in what was entered.
   Walk the statement with them.

**They think entries are missing**

1. Export.
2. Founder Mode → compare **Entries** and **Events in log** with what they expect.
3. Check **Storage used**. Near 5 MB means writes may have been refused — look for whether they saw
   a _"NOT SAVED"_ message.
4. Restore from their most recent export if it is better than what is on the phone.

**They saw "NOT SAVED — this device is out of space"**
The entry was genuinely not recorded, and nothing is corrupted. Export, have them free space
(photos, other apps), then re-enter that entry. This message is the app being honest.

## 2. Restoring one merchant

1. **Export whatever is currently on the phone first**, even if it looks wrong. It is evidence.
2. More → Settings → **Restore from backup** → choose the good file.
3. Vyora shows exactly what the file contains before replacing anything. **Read it aloud to the
   merchant** and get their agreement.
4. Confirm.

Restore **replaces** the ledger; it does not merge. Anything recorded after that backup is gone.

Afterwards, re-enter their **business name** in Settings — profile and preferences are not inside
the export (`KnownIssues.md` H2).

## 3. Rolling back the deployment

Vyora's data is local, so **rolling back code never touches a merchant's book.**

1. Redeploy the previous commit on Vercel.
2. **Bump `SW_VERSION`** in `public/vyora/sw.js` on the rolled-back build. Without it, installed
   merchants keep running the cached broken build — the service worker never updates anyone
   automatically.
3. Tell each merchant to open the app and tap **Reload** when the _"New version available"_ banner
   appears.

**Do not roll back past ARCH-002.** RC1 stores log format **v2**. An older build cannot read it and
will show an empty ledger. If that happens by accident, the merchant's `vyora.alpha.v1` key may still
hold their pre-v2 data, and their export file is the reliable path back.

## 4. The app will not open at all

1. Try `esytol.com/vyora` in a normal browser tab, not the installed icon. If that works, the
   service worker cache is the problem: Chrome → Settings → Site settings → esytol.com → Clear data
   **(this erases their ledger — only after you have an export, or if you already have their file).**
2. If you have their export, install fresh and restore.
3. If you do not have an export and cannot open the app, their data may be unrecoverable. Say so
   plainly and immediately. Do not speculate about getting it back.

This is why §Rule zero exists and why onboarding requires an export before you leave.

## 5. Ending the pilot for a merchant

1. Final export, stored by you.
2. Send them their own file with a plain instruction: _"this is your book — keep it."_
3. Confirm their notebook is back in use before you leave.
4. Closing interview (`InterviewGuide.md`), including _"what would have had to be different?"_

## 6. Communication

**Say, honestly and immediately:**

- what happened
- whether their data is safe
- what you are doing next
- when you will come back to them

**Never say:** "it should be fine", "that's not supposed to happen", or anything you have not
verified on their phone.

**If data was lost, say so directly and apologise once.** A merchant who is told plainly may stay in
the pilot. One who discovers it themselves will not, and should not.

**Template:**

> _"Something went wrong with the app on your phone. Your book is safe / I could not recover
> everything — [be specific]. I have put your notebook back for now. I will come tomorrow at [time]
> and tell you exactly what happened."_

## 7. Stop the whole pilot if

- Two or more merchants hit the same Critical bug
- Any data loss you cannot explain
- Integrity checks fail on more than one phone

Pull everyone back to notebooks the same day, keep every export, and do not restart until the cause
is understood. A pilot that damages a merchant's trust in their own records costs more than it can
possibly learn.
