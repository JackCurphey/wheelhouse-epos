# Proposal: a deleted job's waiting messages don't go out, and deleting a job can't deadlock with a quote answer

## Why

The audit of the flagged merges (22 Oct, `docs/reviews/2026-10-22-flagged-merges-audit.md`,
P3 items 11 and 14, on #265) found two faults in deleting a job:

- **Item 11.** A message still waiting to go (a "Bike ready" in its minute's
  Undo, or any message the timer hasn't sent yet) is sent after the job is
  deleted. Its row only loses its job link (`ON DELETE SET NULL`,
  migration 048), and the engine sends every due waiting row.
- **Item 14.** Deleting a job locks its order, then the job, then removes its
  quote lines. Answering a quote (staff's answer, or the customer's on their
  booking link) records each line's answer, then adds the approved lines to
  the order. If both happen at once, each waits for the other, Postgres
  stops one, and that person gets a server error. Nothing is corrupted.

## What Changes

- **Server:** deleting a job stops, in the same transaction, every message for
  that job still waiting to go (marked `undone`, as Undo marks it). A message
  already being sent, sent or failed is left as it is.
- **Server:** answering a quote locks the job's order first, before it records
  any answer, so it takes its locks in the same order as deleting a job and
  taking a payment (order first). One waits for the other; neither fails.
- No screen changes.

## Lane, work package, drawings and decisions

- **Work package:** follow-up fixes to #265 (deleting a job, WP stage 1
  workshop), from the audit.
- **Lane:** Mark's (server). The engine function is in Mark's
  `server/messaging/engine.js`. Two lines land in Jack's workshop files, kept
  to the minimum: one call and `ORDER BY id` on its order lock in the delete
  route (`server/routes/workshop.js`), and one lock in `answerAndAddToOrder` (`server/workshop/jobs.js`). They
  need Jack's approval (split plan §3).
- **Drawings:** `job-delete-confirm` says "The job, its diary time and its
  files and photos are removed. This can't be undone." It doesn't mention
  messages.
- **Decisions:** `docs/decisions/2026-10-18-attachments-and-delete.md`
  (deleting a job); `docs/decisions/2026-10-20-messages-engine.md` (the
  minute's Undo). Stopping a deleted job's messages is decided here, for
  Jack to overrule, following the built pattern that reopening the work stops
  a waiting "Bike ready" (`undoWaiting`); logged in Mark's section of
  `decided-while-building.md`.

## Out of scope

- Audit item 13 (the refusal's "Refund what was paid", when nothing can
  refund yet): the words are Jack's own, from the decision's drawing
  (`job-delete-blocked`: "Refund what was paid and hand the bike back — then
  delete."), so they stay. Reported to Jack instead.
- Audit item 12 (a deposit not blocking a delete): latent until deposits
  exist.
- Messages with no job, and the outbox's display of undone messages.

## Impact

- Server: `server/messaging/engine.js`, `server/routes/workshop.js` (two
  lines), `server/workshop/jobs.js` (one lock)
- Tests: `tests/workshop-delete-messages.test.js`
- Spec: `workshop-jobs` (the delete requirement)
