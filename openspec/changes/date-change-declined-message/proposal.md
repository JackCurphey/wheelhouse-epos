# Proposal: a declined date change tells the customer

## Why

Staff answer a customer's request to change their booking's date. Accepting
sends "Date change answered". Declining sends nothing today, though the
booking messages decision lists a date change among the answers that send
(`docs/decisions/2026-10-20-booking-messages.md` answer 5), and the drawing
gives the message two wordings: "If the shop accepts" and "If the shop can't"
(`book.mjs:489`, `bk-msg-change`). The 22 Oct audit listed it as item 23.

Mark, 25 Oct: build it as the drawing shows, a second box on the existing
"Date change answered" row, not a row of its own.

## What Changes

- **The declined wording**, as drawn: "Hi [Customer's first name], [Shop name]
  can't do [New day and time], so your booking stays on [Booked day and time].
  See your booking: [Link to the booking]. Your repair · [Job number]."
- **Declining a date change queues it** at once, the customer's way, unless
  "Date change answered" is switched off (one switch covers both wordings).
- **[New day and time] is the day the customer asked for.** Declining clears
  the request, so the answer reads it first and carries it into the message.
- **Settings › Messages:** the "Date change answered" box gets the drawn second
  heading and wording box, "If the shop can't". "Go back to Wheelhouse's
  wording" resets both. The row itself is unchanged.

## Capabilities

### Modified Capabilities

- `messages`: a declined date change sends its message.

## Touches

Messaging core (`server/messaging/templates.js`) and `workshop.js`; needs
`/review`. No migration: the wording is stored as a message template under its
own key, like the others.

## Out of scope

A separate subject line for the declined wording (the drawing shows one
subject for the message).
