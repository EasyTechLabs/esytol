# Founder Pilot Playbook

> How to run the Vyora pilot. Read this before you meet the first merchant.

The pilot exists to answer one question: **will a merchant keep using this instead of their
notebook?** Not "do they like it". Not "do they say nice things". Will they still be using it on
day 10 without you in the room.

Everything below protects the honesty of that answer.

---

## 1. How to introduce Vyora

Say this, in their language, and stop:

> _"This is a small app for your udhaar book. Everything stays on your phone — no account, no
> internet, nobody else sees it. I want to watch you use it for ten days and hear what is wrong
> with it."_

**Say "what is wrong with it" out loud.** It gives them permission to criticise, which is the only
feedback worth having.

Do not say: modern, digital, easy, powerful, better than a notebook, will save you time. If it is
true, they will say it. If you say it first, you will never learn whether it was.

## 2. Onboarding a merchant — 20 minutes

1. **Install it on their phone**, not yours. Watch whether they can find the icon afterwards.
2. **Have them record one real credit** from that day's trade. Real amount, real customer.
3. **Have them record a payment.**
4. **Open Chase.** Ask _"who would you call first?"_ — then see if Vyora agrees with them.
5. **Export a backup and send it to themselves on WhatsApp.** Do not skip this. It is the only
   protection they have.
6. **Show Closing** and ask them to open it at the end of the day.

Then stop. Do not tour the rest of the app.

Leave them `MerchantQuickStart.md` — printed, or as a WhatsApp message.

## 3. What NOT to explain

- **Anything they did not ask about.** Every feature you demonstrate is a feature you can no longer
  learn whether they would have discovered.
- **How it works underneath.** Event logs, offline, indexes — irrelevant to them and it makes the
  app sound complicated.
- **Founder Mode.** Never show a merchant. It is your instrument, not their feature.
- **Anything not yet built.** Do not promise Hindi, reports, or reminders-that-send-themselves. A
  merchant who is waiting for a feature is not evaluating the one in front of them.

## 4. What to observe silently

Write these down. Do not react to them.

- **Time from opening the app to a saved credit.** Stopwatch it. The target is under ten seconds
  once they have done it twice.
- **Where their thumb hesitates.** Hesitation is a design defect, not a merchant defect.
- **Whether they use the due-date chips**, or skip straight to Save. If they skip, Chase degrades —
  and that tells you the chips are not obvious enough.
- **Whether they reach for the notebook anyway.** Note exactly which moment, and what they were
  trying to do.
- **Whether they open Chase unprompted** on day 3, 5, 10.
- **Whether they ever open Closing** without you asking.
- **What they call things.** If they say "khata" and the app says "Parties", the app is wrong.

## 5. When NOT to answer immediately

When a merchant asks _"how do I do X?"_, say:

> _"Show me what you would try."_

Then watch. Only help after they are genuinely stuck, and record **what they tried first** — that is
the design they expected, and it is worth more than the answer you were about to give.

The same applies to _"can it do Y?"_ — answer _"tell me when you would need it"_ before saying yes
or no. You are collecting the problem, not taking an order.

Answer immediately in exactly two cases: **they think they have lost data**, or **they are about to
lose data**.

## 6. How to collect feedback

- **Same day, in writing.** Memory rewrites itself overnight into a tidier, more flattering story.
- **Their words, not your summary.** _"I don't know if it saved"_ is data. _"Merchant found save
  confirmation unclear"_ is your interpretation of data.
- **One file per merchant** using `BugReport.md` and `FeatureRequest.md`.
- **Log what they did, not only what they said.** A merchant who says "it's very good" and has
  recorded nothing since day 2 has told you something specific.

## 7. Daily routine (10 minutes)

- WhatsApp each merchant: _"Anything annoying today?"_ — nothing longer.
- Note who recorded entries and who did not. **Silence on day 4 is the single strongest signal in
  the pilot.** Call them.
- Log any bug the same day, with device and version from **Settings → Version**.
- Do not push, remind, or nudge them to use it. You are measuring whether it survives without you.

## 8. Weekly routine (45 minutes)

- **Open Founder Mode on each merchant's phone** (tap the "Alpha" badge five times) and record the
  eight numbers in `PilotMetrics.md`.
- **Run integrity checks** in Founder Mode. Anything other than all-passed is a stop-everything
  event: export their ledger and send it to engineering before touching anything.
- **Confirm each merchant has exported in the last seven days.** If not, sit with them while they do.
- **One 20-minute interview** using `InterviewGuide.md`.
- Re-rank `KnownIssues.md` from the week's evidence.

## 9. Stop the pilot for a merchant if

- Any balance is wrong and you cannot explain why → export the ledger, send it to engineering, and
  put them back on their notebook that day.
- They lose data. Restore from their export, then decide together whether to continue.
- They ask to stop. Accept immediately, thank them, and ask one question: _"what would have had to
  be different?"_

## 10. What success looks like

Not enthusiasm. **Day-10 unprompted use**, an accurate book, and at least one merchant who is
annoyed that a specific thing is missing — because that is a merchant who has started depending on
it.
