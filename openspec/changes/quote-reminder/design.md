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

## From the fresh review
- When a reminder falls due, the engine's sweep checks it's still needed
  (`reminderStillNeeded`): the job still there, the bike not collected, the
  booking not ended, the newest quote still `sent`, and Quote to approve and
  the reminder on. Otherwise it's marked undone, so deleting, collecting,
  cancelling or switching messages off all stop it.
- Queueing the reminder has its own error handling: a fault there is logged,
  never reported as the quote's message not going.
- Staff Messages hide reminders stopped this way, say the day of one waiting
  past today, and don't re-check every few seconds for one a day away.
- Settings: the "N on" count leaves the reminder out; the hours box waits for
  the shop's settings.
