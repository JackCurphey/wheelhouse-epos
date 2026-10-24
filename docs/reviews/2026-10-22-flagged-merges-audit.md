# Audit of the "Check #…" merges in STATUS.md

Read-only audit, 22 Oct 2026, of the server side of #265, #271, #273, #275,
#283, #315, #319, #336, #337 and #341. Each was checked against the code at
HEAD (`c240169f`), its OpenSpec change (archive) and the decisions it cites.
No code was changed and nothing was committed. Four reviewer subagents read
the merges; I re-read the two P2 code findings myself (website.js,
accept-offer) and the delete and engine code behind findings 3 and 5.

**Headline:** no P1 bugs (security, data loss, overbooking) in any of the
ten. Several weak spots in the original merges were fixed by later commits:
the delete is one transaction (396d1190), `recordSignOff` uses a savepoint,
and the legacy save that reopened jobs is gone (e5335ad6). There are three
P2s worth acting on, then P3s and missing tests.

---

## Where each finding went (added 22 Oct, evening)

| Finding | What happened |
|---|---|
| P2 1, website and Shopify routes | Owner-only, Jack's #393 (merged). The hosted copy also refuses the Shopify connection (#401). |
| P2 2, accepting a time not shown | Jack's #396: the accept carries the time shown, and a save can't move an offered booking. |
| P2 3, the messages spec on Undo | Spec corrected, Jack's #395 (merged). |
| 4–10, missing tests | Mark's #407 (the two skipped offer tests now run against #396). Item 10's scan is wider; the four routes left open are listed in the test with reasons. |
| 11 and 14, deleted job's messages, delete deadlock | Mark's #408. The deadlock was real. |
| 13, the refusal's wording | Not changed: the words are Jack's drawn ones (`docs/decisions/2026-10-18-attachments-and-delete.md`). |
| 19, 21, 22, input checks | Mark's #410. |
| 12, 15–18, 20, 23, 24 | Open. Not scheduled. |

---

## P2: fix or decide

### 1. Website settings, including the Shopify connection, are writable by any staff member (follows on from #283)
- `server/routes/website.js:31` `PUT /api/storefront-settings`
- `server/routes/website.js:46` `POST /api/shopify/connection`
- `server/routes/website.js:75` `POST /api/storefront-settings/logo`
- `server/routes/website.js:86` `POST /api/storefront-settings/hero`

None calls `ownerOnly` or checks `is_owner`; only the dispatcher's
signed-in check applies (`server/server.js:662`). A cashier can replace the
Shopify domain and token (old app form `public/app.js:3135`, `:3151`),
which redirects webhook registration and stock sync, or replace the logo or
hero image.

The #283 proposal put website settings out of scope, so this isn't a breach
of its letter. But the decision's reasoning (`docs/decisions/2026-10-19-owner-only-settings.md`)
and the follow-up b17dbf5b ("every settings and team changing route
Owner-only") leave website.js as the odd one out. **Needs Jack's or Mark's
call** (now, or with WP-1.1).

### 2. The customer can accept an offered time they never saw (#315)
- `server/routes/portal.js:1085-1106` (accept-offer): the request carries
  no version and no date or time; it confirms whatever is offered when the
  button is pressed.
- `server/routes/workshop.js:899-949` (offer): staff can replace an offer
  ("Offer this time replaces the first offer", decision 4 of
  `docs/decisions/2026-10-20-offer-another-time.md`).
- The job save (`server/routes/workshop.js` ~590-713, version optional)
  can move an offered booking without changing its state.

What goes wrong: the customer's page shows Fri 12:00. Staff re-offer Mon
09:00 (or drag the booking in the diary). The customer presses Accept and
is confirmed for Monday without seeing it. After a drag, no message tells
them. This breaks the book spec's "Accepting the offer" (confirmed for the
time suggested to them).

Fix: accept-offer sends the date and time it shows (or the job's version)
and gets a 409 `stale` on a mismatch. State in the design whether the job
save may move an `offered` booking.

### 3. The messages spec contradicts itself on Undo (#336)
- `openspec/specs/messages/spec.md:34-35`: every message staff trigger
  "SHALL wait a minute before it goes" and can be undone.
- `openspec/specs/messages/spec.md:53` (added by #336): the booking
  messages are queued "at once". The code matches line 53: `sendBookingMessage`
  → `queueMessage` with no delay (`server/routes/workshop.js:327`).

So staff who press Accept or Decline by mistake get no Undo, though the
spec promises one. The choice is logged in `decided-while-building.md` (20
Oct booking-message-triggers, item 1), but the older requirement was never
narrowed. Fix: narrow lines 34-35 to exclude the booking answers, or Jack
overrules (touches drop-off and quote decision 5).

---

## Missing tests (P2/P3)

4. **#315, the offer race above:** there's no test for accepting after a
   re-offer or after staff move the booking (`tests/workshop-offer.test.js`).
   Also untested: offering on a cancelled, declined or expired booking
   (the code refuses it at `server/routes/workshop.js:915`), and expiring
   an offered booking.
5. **#336, a refused answer sends nothing:** no test checks that a refused
   accept, offer or accept-change (stale, busy mechanic) queues no
   message. The code is right today (queued only after the lock commits,
   `server/routes/workshop.js:255`, `:861-870`, `:947`), but
   `tests/workshop-accept-mechanic.test.js:64-94` never looks at
   `customer_messages`.
6. **#337, against its own design:** the design
   (`openspec/changes/archive/2026-10-20-accept-mechanic/design.md`) says
   an inactive mechanic is refused, but only an unknown ID is tested
   (`tests/workshop-accept-mechanic.test.js:78`). Also untested: an
   employee who isn't a mechanic, another shop's mechanic, and a mechanic
   on their day off.
7. **#341:** no test for accept-change with an unreachable customer
   returning `bookingMessage` (`server/routes/workshop.js:255-256`), or for a
   switched-off message leaving `bookingMessage` out of the reply.
8. **#265:** server tests don't cover:
   - the combined "paid and bike in shop" wording;
   - deleting a job with sign-off history, or a collected job;
   - another shop's job ID giving 404 on DELETE.
9. **#275:** `tests/portal-booking-link-checked.test.js` doesn't cover a
   reopened job (sign-off cleared, so no name) or shop A's link ignoring
   shop B's setting. Both are correct in the code today.
10. **#283:** `tests/owner-only-routes.test.js` scans only
    `workshop-settings.js`, `shop-settings.js` and `team.js`, so it would
    not catch finding 1, or a new unguarded route in `messages.js` or
    `sites-tills.js`. It also counts any `login.is_owner` text, even in a
    comment, as "guarded".

---

## P3: minor or latent bugs

11. **#265, messages for a deleted job still go out.**
    `customer_messages.job_id` is `ON DELETE SET NULL` (migration
    048:29). The delete route (`server/routes/workshop.js:1140-1199`)
    doesn't mark the job's waiting messages `undone`, and the engine sends
    any due `intended` row (`server/messaging/engine.js:122-126`). A
    "Bike ready" still in its Undo minute when staff delete the job is
    sent anyway. Fix: mark them `undone` in the delete transaction.
12. **#265, a deposit won't block a delete (latent).**
    `server/routes/workshop.js:1162` treats an order as paid only when
    `status = 'converted'`. The decision (`2026-10-18-attachments-and-delete.md`
    answer 1) says "a deposit or a payment". Once deposits exist
    (`paid_pence`, migration 051), a deposit on an open order wouldn't
    block the delete. Fix: also refuse on `paid_pence > 0`.
13. **#265, the refusal promises a way out that doesn't exist.** "Refund
    what was paid" (`server/routes/workshop.js:1168`), but there's no
    refund route, and nothing moves an order away from `converted`. A
    paid job (even one paid £0) can never be deleted. This matches the
    decision's intent; worth telling Jack, not reopening it.
14. **#265, possible deadlock.** Delete locks the order, then the job, then
    deletes the quote lines; `answerAndAddToOrder` (`server/workshop/jobs.js:583`)
    locks the quote lines, then inserts order lines against the order. If
    both run at once, Postgres aborts one and the user gets a 500. Rare;
    nothing is corrupted.
15. **#315, an offer can be made on a bike already in the shop.**
    `server/routes/workshop.js:915` checks only the booking state. The
    customer then can neither accept nor cancel, so it waits until staff
    decline it or it expires.
16. **#315, an offer can be for a time already gone today.**
    `server/routes/workshop.js:920` refuses only past dates;
    `customerTooLate` (`server/routes/portal.js:85`) compares dates
    only.
17. **#315, offer message type.** `server/routes/workshop.js:907` turns
    any value into text (an object is stored as "[object Object]"),
    whereas decline (`:742-745`) refuses anything that isn't text. The
    1,000-character limit is there.
18. **#315, untimed offers in drop-off mode skip the day's capacity
    check** (`checkJobSlot`, `server/workshop/jobs.js:460`). This is
    deliberate per the design (a staff choice), but accepting then confirms
    onto a possibly full day. Note only.
19. **#337, `mechanicId` isn't checked to be an integer.**
    `resolveJobMechanicId` (`server/workshop/jobs.js:107-114`) uses
    `Number()`: "abc" or 1.5 probably gives a 500 rather than a 400 (not
    run), and `true` becomes employee 1. The offer route and the job save
    share this.
20. **#337, the mechanic is checked before the lock, not again inside it**
    (`server/routes/workshop.js:762-766`). A mechanic switched off in that
    gap still gets the job. Same pattern as the job save.
21. **#271, a mechanic deleted mid-finish gives a 500, not a 400.**
    `server/routes/workshop.js:755` checks before the transaction, and
    `recordSignOff` then throws. It rolls back cleanly.
22. **#275, a sloppy value can turn on the privacy setting.**
    `server/routes/workshop-settings.js:400-401` uses JavaScript
    truthiness, so the string `"false"` turns "Show who signed off" on.
    Only the Owner can send it now (#283). Better to accept only a real
    true/false. `showPricesOnline` has the same pattern.
23. **#336, known gap: declining a date change sends nothing**
    (`server/routes/workshop.js:954-956`), though decision
    `2026-10-20-booking-messages.md` answer 5 lists "a date change". It's
    logged in decided-while-building (items 2 and 6).
24. **#336, latent:** with `DB_TENANT_SCOPE=transaction`, an error caught
    in `sendBookingMessage` would poison the request transaction and roll
    back the answer. Logged as item 7; the default (session mode) is safe.

---

## Checked and sound (summary)

- **#265:**
  - Every table that references a job is handled: cascades, deleted
    first, or unlinked.
  - Delete is one transaction with order-then-job locks, and the files
    are unlinked after commit.
  - Any staff member may delete, which is Jack's explicit choice.
- **#271:**
  - Migration 040 is additive, with row security enabled and forced on
    `workshop_job_sign_offs`, and `ON DELETE SET NULL` with the name kept.
  - Finish refuses (400 `sign_off_required`) before anything moves.
  - Reopening clears the sign-off in the same transaction.
- **#273:**
  - A payment is never refused over the sign-off; warnings come back
    instead.
  - It records only when the payment finishes the work.
  - The savepoint keeps a failed sign-off from rolling back the payment.
- **#275:**
  - `checkedBy` is shown only with the setting exactly on and the bike
    ready or collected.
  - It's scoped to the shop by row security, and the setting starts off.
- **#283:**
  - `ownerOnly` reads the session as `team.js` does and fails closed
    (401, 403 `owner_only`, 500 with nothing written).
  - There's no method or path bypass, and every write to
    `workshop_settings` and `shops` is guarded.
  - Message templates, sites, tills and PINs are Owner-only too.
- **#315 / #319:**
  - Migrations 046 and 047 don't clash and only widen the CHECK.
  - `status` matches `legacy-status.mjs`.
  - `offered` counts as live for capacity, with the hold kept from the
    offer.
  - Offer and accept-offer run under the day lock with the job locked.
  - A second accept is harmless.
  - The decline message is text only, trimmed, at most 1,000 characters,
    and saved in the decline's transaction.
- **#336 / #341:**
  - Messages are queued only after the lock's transaction commits, and a
    failed queue leaves the answer standing.
  - A retry gets a 409, so nothing is sent twice.
  - Per-shop templates and row security apply.
  - The sender is always the pretend one (`isPretend()` is true, the
    link is "[link]").
  - The `bookingMessage` shape matches the notice design.
- **#337:**
  - The same per-shop, per-day advisory lock as the job save, the create
    route and portal bookings.
  - The mechanic is checked free inside the lock.
  - A missing `mechanicId` keeps the current mechanic; null means the
    shared queue.
- **Role checks on workshop routes:** any signed-in staff member, in line
  with the decisions (sign-off: tap a name, no PIN; delete: not just
  managers). No gaps against a decision except finding 1.
