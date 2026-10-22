# Design: a deleted job's waiting messages, and the lock order

## Stopping the messages (item 11)

A new `undoJobMessages(jobId)` in `server/messaging/engine.js` marks every
row for the job with `intent_state = 'intended'` as `undone` (both
`intent_state` and `status`, as `undoMessage` and `undoWaiting` do). Unlike
the staff Undo it doesn't check `send_after`: a message whose minute is up but
which the timer hasn't claimed yet is stopped too, because the job it is about
is gone. `undone` is the messageIntent machine's `undo` move from `intended`
(`server/workshop/state-machines.js`), final, so it can never be retried.

The delete route calls it inside `withJobBookingLock`, after the refusal
checks and before the job row is deleted, so it commits or rolls back with the
delete. A refused delete stops nothing.

Against the timer: the timer claims a message with one `UPDATE … WHERE
intent_state = 'intended'`. If the timer claims first, the message is
`sending` and the delete leaves it (it is already on its way). If the delete
marks it first, the timer's update waits for the delete's commit, re-reads the
row, sees `undone`, and skips it (Postgres's read committed). Either way it is
sent at most once and never after the delete commits.

## The lock order (item 14)

Today:

| | 1st | 2nd | 3rd |
|---|---|---|---|
| Delete a job | the job's orders (`FOR UPDATE`) | the job (`FOR UPDATE`, under its booking lock) | its quote lines (delete) |
| Answer a quote (`answerAndAddToOrder`) | the quote lines (update) | the quote (update) | the order (adding lines takes a key-share lock on it, then updates it) |
| Take a payment | the order | the job | |

Delete and answer take the order and the quote lines in opposite orders, so
they can deadlock. The fix: `answerAndAddToOrder` first locks the job's orders
(`SELECT id FROM sale_documents WHERE workshop_job_id = (the quote's job)
ORDER BY id FOR UPDATE`), inside its transaction, before answering. Every
path then takes the order first. A job with no order locks nothing, as before.
The delete's own order lock gains `ORDER BY id` too, so a job with two orders
has them locked in the same order by both.

What happens instead:

- Answer first: the delete waits; once the answer commits, the delete goes
  through (the order is still open and unpaid, so nothing is refused) and the
  order keeps the added lines, unlinked.
- Delete first: the answer waits; once the delete commits, the quote is gone
  and the answer is refused as not found.

Saving a quote (`createRevision`) runs without a transaction, each statement
on its own, so it holds no lock while waiting and can't deadlock with a delete.

## Testing

`tests/workshop-delete-messages.test.js`:

1. A job with a "Bike ready" in its minute and another message whose minute is
   up but not yet claimed: delete the job; both are `undone` (the timer only
   claims `intended` rows, so it can never send them). A delivered message
   for the same job is left delivered. The test file slows the timer to an
   hour so it can't claim the due message first.
2. A refused delete (bike in the shop) leaves the waiting message waiting.
3. The deadlock, forced with a trigger (as the payment race test in
   `tests/workshop-action-transactions.test.js` does): a trigger makes adding
   a line to the order sleep, so the delete arrives while the answer holds its
   quote lines. Today one of the two gets a 500; with the fix both succeed.
4. The other way round: a trigger makes the delete sleep after it has locked
   the order and the job, and the answer arrives meanwhile. Today one gets a
   500; with the fix the delete succeeds and the answer is refused as not
   found, with nothing added to the order.
