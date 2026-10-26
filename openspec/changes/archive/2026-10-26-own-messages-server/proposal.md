# A shop's own automatic messages, the server

## Why

Owner setup decision 14 (Jack, 30 Sep): shops can reword and switch every
message, "and create their own" automatic messages, each with a "send when…".
Stage 1 drawing gaps decision 7 puts them in Settings › Messages as "Your own
messages", with "+ Add your own message". The add box is drawn as
`set-msg-new`. The questions the drawing left open were answered by Jack on
26 Oct (`docs/decisions/2026-10-26-receipt-and-own-messages.md`).

This is the server half. Its screens are `own-messages-screens`.

**Risky areas:** a migration (085) and the messaging core
(`server/messaging/**`). `/review` runs before merging.

## What changes

- **A shop's own messages are stored** with:
  - a name;
  - when each one goes: after a job is collected, before a booked job, or
    after a sale;
  - how long after or before, in days or months;
  - whether it goes by text, by email, or both;
  - its wording, and whether it's on.
- **Owner-only routes** list, add, change and remove them.
- **They go by themselves:**
  - only to customers who said yes to offers and news;
  - only while the shop is open;
  - only for things that happen after the message was set up, or last
    retimed or switched on;
  - once per job or sale.
- **Each one ends "Stop these: [link]".** The link stops just that message
  for that customer (Jack's answer 2).
- **"After a sale"** goes only for a sale with a customer on it (answer 3).
- **The email subject** is the message's name (answer 5).
- **Removing a message** stops any of its messages still waiting.

## Not changing

- **The built-in messages** and how they go.
- **Real sending stays pretend:** links read "[link]".
