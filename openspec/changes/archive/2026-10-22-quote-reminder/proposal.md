# Proposal: one reminder when a quote has no answer

## Why
Jack, 1 Oct (`docs/decisions/2026-10-01-drop-off-and-quote-review.md`):
"After a time the shop sets ([n] hours), the customer gets one reminder…
A quote never expires by itself". Drawn as the Settings › Messages row
"Reminder if there’s no answer, after [n] hours" with "Edit" for "Quote
reminder" (setup.mjs), and the customer's "we sent a reminder at [time]"
(dq-quote-reminded). Jack, 22 Oct: "1: use the drafted quote reminder
wording, sent once after 24 hours with no answer (shops can change the
hours)."

## What changes
- **Migration 060**: `workshop_settings.quote_reminder_hours`, 1 to 168,
  24 to start.
- **Messages**: "Quote reminder" (`quote_reminder`), Jack's approved wording,
  facts only (decision 7).
- **Server**: sending a quote also queues its reminder for the shop's hours
  later; answering, withdrawing or replacing the quote stops a reminder still
  waiting. The customer's quote reply carries `reminderSentAt`.
- **Settings › Messages**: under Quote to approve, the drawn reminder row:
  the hours and Edit.
- **Customer card**: "Sent Thu 17 Sep, 10:15 · we sent a reminder at 10:15".

## Not in this change
"No answer yet" on Today and in the diary after the reminder
(dq-today-no-answer): the next piece.

## Risky areas
A migration, the messaging core and a public route reply. Reviewed.
