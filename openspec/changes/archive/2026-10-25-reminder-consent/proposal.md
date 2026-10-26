# Proposal: saying yes to service reminders when booking

## Why

Account, history and reminders decision 2 (Jack, 1 Oct,
`docs/decisions/2026-10-01-account-and-reminders-review.md`): the shop sets
a reminder gap on each service, and the customer says yes once, "When
booking or collecting … ticks 'Remind me when my bike is due its next
service'". Decision 8 (audit H1): the tick starts unticked, and the same
tick is their yes to a review request.

The booking's details step is drawn with it (`ac-book-remind`, agreed;
`book.mjs:217-218`, `settings-frame.mjs:307`):
- "Remind me when my bike is due its next service"
- "And ask me for a review after I collect. One message each, the way you
  chose above. Stop any time."

This is WP-4.5's first piece. The yes has to be collected before any
reminder can be sent, and nothing else is needed to collect it: no sign-in,
no services editor, no key. Jack's lane.

## What Changes

- **The tick on the booking's details step**, under "How should we send
  updates?" and the email box, as drawn. It starts unticked.
- **The booking saves the answer on the customer.** Ticked, it records a yes
  to service reminders and to review requests, with when it was given and
  that it came from a booking. Unticked, it changes nothing: not ticking
  isn't a "stop".
- **The tick stays in the saved draft,** as the other answers do.

## Capabilities

### Modified Capabilities

- `book`: the details step asks the reminder question, and a booking saves
  the answer.

## Out of scope

- **Sending any reminder.** That needs the months on each service, the
  message, and "Stop these" (the next pieces, drawn in `ac-services`,
  `ac-reminder-wording` and `ac-stopped`).
- **The same tick at collection.** It is drawn only on the ready page's
  pay-online card (`cp-summary`, `collect.mjs:81`), which isn't built.
  The in-shop card that is built (`cp-summary-inshop`) is drawn without it,
  so it is a question for Jack.
- **The customer's account page and its switches.** These wait for the
  emailed-code sign-in (WP-1.7).
