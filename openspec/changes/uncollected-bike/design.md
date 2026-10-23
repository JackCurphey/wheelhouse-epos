# Design: a bike left uncollected

## Context

"Marked ready" is the work's `finish`, which always signs the job off
(`signed_off_at`, `server/routes/workshop.js` ~847–883); reopening clears it.
Bike ready is queued there (`queueBikeReady`) with its Undo minute. The quote
reminder (#418) is the pattern for a message that waits days: queued with a
delay, re-checked when it's due (`reminderStillNeeded`, `engine.js`), with
its setting on `workshop_settings`.

## Decisions

1. **The days count from `signed_off_at`**, the time the work was marked
   ready (M5). No new "ready at" column: every finish signs off, and reopen
   clears it, so a bike finished again counts afresh.
2. **Queued at ready, re-checked when due**, as the quote reminder: queued in
   the finish's transaction beside Bike ready, `delayMs` the reminder's days;
   when due it goes only if the bike is in the shop, the work complete and
   signed off, the order not paid (`converted`), and the message on.
   Reopen stops it (`undoWaiting`). *Alternative:* a daily scan that queues
   it when due. Rejected: the message's link is issued with the request's
   address (`publicBase(req)`), which a timer doesn't have.
3. **The words are filled in when it's queued**, as every message is. A bike
   paid for at the till but left in the shop isn't reminded (decision 2), so
   "[What’s left to pay]" can't be stale: it reads "£111.00 to pay on
   collection" while something is owed, "Paid — nothing more to pay" when the
   order is paid, and "Nothing to pay on collection" with nothing on it (Bike
   ready's words). A change of day count applies to bikes marked ready after.
4. **Today's line is a kind on `GET /api/needs-attention`** (`uncollected`):
   `custody_state = 'in_shop'`, `work_state = 'complete'`, `signed_off_at`
   older than the Today count, and not contacted since that time. Oldest
   first, after the quotes. It carries `jobId`, `reference`, `customerName`,
   `bikeLabel`, `phone`, `readySince`, `reminderSentAt`.
5. **Contacted** is `POST /api/workshop-jobs/:id/contacted`, Owner only like
   the list; it records `uncollected_contacted_at` and
   `uncollected_contacted_by_login_id` and refuses a bike that isn't on
   the list (409). Contacted before the latest ready time doesn't count.
6. **Defaults 3 and 7 days** (the drawing shows `[n]`). 7 follows the build
   plan's flag for uncollected online orders (Q8,
   `2026-10-03-build-plan-questions.md`); 3 comes before it. Logged for Jack
   to overrule. Limits: reminder 1–60, Today 2–90.

## Risks / Trade-offs

- [A shop shortens the reminder after bikes are queued] → Those keep their
  time; only bikes marked ready after use the new count. Said in the hint.
- [The order is paid while the bike stays] → No reminder; the Today line
  still shows it.
