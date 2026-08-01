# Vyora Merchant Productivity

> **Status:** ✅ Complete (V2-006 + V2-006.1) — all 9 requirements ·
> **No new engine, no new index** · **Last Updated:** 2026-08-01

- **Domain:** [`lib/vyora/productivity.ts`](../lib/vyora/productivity.ts) (pure)
- **Tests:** [`tests/vyora/productivity.test.ts`](../tests/vyora/productivity.test.ts)

---

## 1. Delivered

**Navigation cleanup (Req 8).** The bar is four destinations — **Home · Chase · Parties · More** —
assembled from the module registry, with `navRoutes()` forcing More last because a drawer belongs at
the end of a thumb's sweep. Settings, Closing and Founder Mode moved under More automatically: they
declare `nav: false` and `moreRoutes()` picks them up, so a new module needs no edit here.

**Capture as floating actions (Req 7).** New Credit and New Payment are now pill buttons floating
above the bar in the easiest part of the thumb arc, and they hide on the capture screens themselves.
Nav items stretch to fill the bar instead of fixed 56px targets, and the bar respects
`safe-area-inset-bottom`.

**Recent customers (Req 3).** The last ten contacts touched, most recent first, shown as taps above
the search field whenever it is empty. Recorded automatically in `dispatch` from the emitted events,
so _any_ command that records an entry gets it — no call site has to remember.

**Favourites (Req 4).** A star on every row of Parties. Pinned customers sort first, in the
quick-pick row and the contact list. The ordering is a **stable partition**, not a re-sort, so
pinning someone never scrambles everyone else.

**Quick amounts (Req 5).** ₹100 / ₹500 / ₹1000 / ₹2000 chips under the amount field, with the
merchant's **own last amount promoted to the front** — a shop selling ₹250 items should not type 250
twice.

**Fast search (Req 6).** Already O(P) over the precomputed `SearchIndex` since ARCH-001. A test
measures it against 500 contacts and asserts it stays inside the 50 ms budget; the field was already
autofocused.

Also: a **call button** on every contact row, and pin/call placed outside the row link so tapping
them never navigates away.

## 2. Completed in V2-006.1

**Long-press quick actions (Req 1).** Press and hold any contact for a bottom sheet: Call ·
WhatsApp · Record credit · Record payment · Statement · Delete. **Movement cancels the press**, so
scrolling a list never opens a sheet — the failure mode that makes long-press feel broken on phones.
A press that becomes a long press swallows the click, so the row does not also navigate. Right-click
opens it on desktop.

Every action reuses what exists: `tel:` and `wa.me` are the phone's own apps, credit and payment are
existing routes pre-filled with the contact, and delete goes through the `DeleteContact` command —
validated and confirmed like any other write. **WhatsApp is a link the merchant taps: no API, no
automation, nothing sent by Vyora.**

**Bulk recovery (Req 2).** "Select" turns the workspace into multi-select, the count sits on the
share button, and one share hands every message to the merchant's own share sheet. Reminders are
recorded **only after the share actually goes out** — cancelling records nothing. Leaving selection
mode always clears the selection, so a stale tick can never be shared later by accident.

`buildBulkReminderMessage` reuses `buildReminderMessage` per contact rather than writing a second
template, so bulk and single reminders cannot drift apart in tone.

**Success feedback (Req 9).** One pure function — `successFeedback(command, result)` — decides what
every completed action says, and the **provider** renders the single `Toast`. Screens never write a
confirmation, which is what makes "no duplicate toast implementations" a property rather than a
promise; two tests enforce it.

Messages name what happened: _"Credit of ₹500 recorded for Ramesh"_, not "Success". Destructive
actions use a warning tone. **A failed command produces no success feedback at all** — errors keep
using the workflow machine's existing path, because a second error route would be exactly the
duplication this milestone removed.

## 3. Where the preferences live

Recency, favourites and last amount are **device preferences** in the existing settings store, not
ledger facts. They do not travel with an export — the same trade-off as per-contact credit periods
in V2-003, and worth revisiting together if you want preferences to survive a phone change.

## 4. Known limitations

- **Recency is per device**, so a restored backup starts with an empty quick-pick row.
- **Favourites are uncapped in the UI** but capped at 50 on read; pinning most of a large book would
  make the "pinned first" ordering meaningless.
- **The search performance test measures the selector, not the render.** It proves the index is
  fast; it does not prove the keystroke-to-paint path is.
- **No haptics on the floating actions** — worth adding when there is a real device to feel them on.
