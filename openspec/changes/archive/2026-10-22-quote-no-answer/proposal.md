# Proposal: "No answer yet" after the quote reminder

## Why
Quotes (WP-4.2). Jack, 1 Oct (`docs/decisions/2026-10-01-drop-off-and-quote-review.md`,
decision 4): after the one reminder, "still nothing, and the job shows 'No
answer yet' on Today and in the diary with the customer's number". Drawn on
Today as dq-today-no-answer (`generator/quote.mjs`, `today({ noAnswer })` in
`opening.mjs`): "WH-1042 · Maya Patel — no answer to the quote yet", "Sent
[time] · reminder sent [time] · [phone]", and "Record their answer". The
reminder itself is built (#418, `openspec/changes/archive/2026-10-22-quote-reminder`).

## What changes
- **Server:** each job read carries, on its quote, when the quote was sent
  and when its reminder went (`sentAt`, `reminderSentAt`), the reminder only
  if it went after that quote was sent and the quote is still waiting.
- **Diary:** a job whose quote is still waiting after the reminder reads "No
  answer yet" where it would read "Quoting": on a wide block, in the month
  view's day list, and in what a screen reader hears for every block and
  chip. Its colour stays Quoting's.
- **Job page:** above Withdraw quote and Record their answer, the drawn
  Today line: "No answer to the quote yet", "Sent [time] · reminder sent
  [time] · [customer's phone]" (a phone link).

## Not in this change
Today (WP-1.10) isn't built; its line is logged in `decided-while-building.md`
for when it is.

## Risky areas
None of the four: a read of the job list (no migration, no money or stock,
no public route, not `server.js` or the messaging core). Self-reviewed.
