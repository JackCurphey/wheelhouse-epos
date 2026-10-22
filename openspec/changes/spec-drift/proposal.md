# Proposal: two specs say what the code does

## Why

Two lines in `openspec/specs/` promise something the code doesn't do. Spec
text only; no code changes.

**(a) Messages: a minute to Undo.** The `messages` spec says "A message staff
trigger SHALL wait a minute before it goes, and Undo in that minute SHALL stop
it." A later requirement in the same spec, from the booking message triggers
(#336), says the booking answers' messages are queued "at once". The code
does the second: `sendBookingMessage` in `server/routes/workshop.js` queues
with no delay, and only Bike ready waits a minute on the server
(`delayMs: UNDO_MS`). Quote to approve has its minute's Undo in the quote
panel before the quote is sent, then goes at once; the old app's one-off text
goes at once. The first line is out of date for everything but Bike ready and
the quote.

The minute's Undo comes from two places, and both are about these two
messages only:

- `docs/decisions/2026-10-01-drop-off-and-quote-review.md` decision 5:
  "**Sending a quote is one click, then Undo** (Jack, 1 Oct: "1"). … a bar
  says "Quote sent to Maya by text · Undo" for a minute". As built, the
  quote panel holds the send for that minute ("Sending the quote to
  [customer] by text in 1 minute.") and sends when it ends; the spec follows
  what is built.
- UX walk-through H2 and the drawn bar "“Bike ready” goes to Maya by text in
  1 minute" (`diary.mjs`), built by the messages engine.

Jack's two 20 Oct decisions don't give the booking answers an Undo:

- `docs/decisions/2026-10-20-messages-engine.md` answer 1: "1: pretend for
  now: every message goes to an outbox in the app; real sending switches on
  later, only with my yes." It says nothing about a wait.
- `docs/decisions/2026-10-20-booking-messages.md` answer 4: "Approve the six
  booking messages' wording and their edit boxes." They are built "with the
  messages engine (WP-1.8) and the booking messages' triggers (WP-4.4)"; no
  Undo is drawn for an accept, an offer, a decline or a date change answer
  (`booking-message-triggers` proposal: "At once, the customer's way,
  pretend (no Undo is drawn for these answers)").

So the Undo line is narrowed to the two messages that have one. Nothing new
is decided.

**(b) Workshop jobs: the old app's save.** The `workshop-jobs` requirement
"Staff move a booking with accept, decline, request reschedule, cancel and
expire" ends: "declined, expired and cancelled are final; the old app's save
can still reopen them". That is out of date: the spec is wrong, the code is
right. Saving a job refuses any `status` field with 400 ("A job's status
can't be changed by saving it. Use the job's own actions instead…",
`server/routes/workshop.js`, the job save route), and
`tests/workshop-legacy-save-version.test.js` ("a save with status scheduled
does not un-cancel a cancelled booking") checks that a cancelled booking stays
cancelled. The same spec's requirement "Creating a job may carry an old
status; saving one may not" already says so, with the scenario "A cancelled
booking saved as scheduled … is refused and the booking stays cancelled". The
`guard-ended-booking` change says the same in its out of scope ("The old
app's save: it no longer changes a job's status at all"); its delta doesn't
touch this requirement, so the two changes don't overlap.

## What Changes

- `messages`: "Staff can undo a message for a minute" becomes "Staff can undo
  Bike ready and a quote for a minute": Bike ready waits a minute on the
  server; a quote has its minute's Undo before it is sent; the booking
  answers' messages and the old app's one-off text go at once, with no Undo.
  A Bike ready Undo scenario and a booking answer scenario are added.
- `workshop-jobs`: the accept/decline requirement says ended bookings are
  final for a save too, pointing at the save requirement.
- The `messages` spec's Purpose line ("with a minute to Undo where staff
  trigger them") is narrowed the same way by hand when this change is
  archived, because a spec delta carries requirements only (task 2.2).

## Lane, work package, drawings and decisions

- **Lane:** Mark's (spec text for server behaviour). Queue item `spec-drift`.
- **Work package:** none; keeping two specs true (WP-1.8's messages engine
  and WP-4.4's triggers; WP-0.4's workshop jobs).
- **Drawings:** the Bike ready Undo bar (`diary.mjs`); the quote bar
  (drop-off and quote decision 5). No drawing changes.
- **Decisions:** `docs/decisions/2026-10-01-drop-off-and-quote-review.md`
  decision 5; `docs/decisions/2026-10-20-messages-engine.md` answer 1;
  `docs/decisions/2026-10-20-booking-messages.md` answer 4. None is reopened.

## Out of scope

- Any code, test or screen change.
- Moving the quote's Undo to the server (a later piece, messages engine
  design).
- Whether booking answers should get an Undo: that would be a new decision
  for Jack, not a spec fix.

## Impact

- Specs: `messages`, `workshop-jobs`. Nothing else.
