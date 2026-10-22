# Design

The reminder is a message queued with a delay, as Bike ready waits its
minute: `queueMessage({ key: 'quote_reminder', delayMs: hours × 1 hour })`
when Send quote's message is queued, after stopping any reminder of the job
still waiting (`undoWaiting(jobId, 'quote_reminder')`). The engine's sweep
sends it when due. One reminder per sent quote; a new revision sent brings
its own.

Stopping it: answering (online or recorded), withdrawing, and replacing a
sent quote with a new revision each call `undoWaiting(jobId,
'quote_reminder')` in `server/workshop/quotes.js`, inside the same request.

`quote_reminder_hours INTEGER NOT NULL DEFAULT 24 CHECK (1..168)`;
`PUT /api/workshop-settings` takes `quoteReminderHours`, a whole number from
1 to 168 ("Choose from 1 to 168 hours."). Owner only, as the rest of
Settings. The reminder row has no switch drawn: it goes when Quote to approve goes,
and its wording can be edited.

`reminderSentAt` on the customer's quote reply: the latest `quote_reminder`
for the job sent since the quote was sent, or null.
