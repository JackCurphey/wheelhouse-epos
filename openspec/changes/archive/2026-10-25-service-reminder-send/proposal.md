# Proposal: sending service reminders

## Why

Account and reminders decision 2 (Jack, 1 Oct): a service's reminder goes
when a bike is due its next service, to customers who said yes. Built so far:
- the yes when booking (#483, migration 077);
- each service's months (#485, migration 078).

Jack's answers of 25 Oct (`docs/decisions/2026-10-25-morning-questions.md`
1 to 4) settle when and how it goes. The wording is drawn and agreed
(`ac-reminder-wording`, `account.mjs:219-222`):
- "Hi [Customer’s first name], your [Bike] is due its [Service] at [Shop
  name]. Book a repair here — it’s ready to go: [Link to book]."
- Always followed by "Stop these: [link]".

Jack's lane. This is the messaging core, a risky area.

## What Changes

- **A Service reminder message** with the drawn wording and tap-ins, ending
  "Stop these: [link]". Sending stays pretend, and both links read "[link]"
  as every pretend message's links do. It shows in Settings › Messages,
  where it can be reworded or switched off like the others.
- **Set up when a bike is collected:**
  - only for a customer who said yes;
  - at the soonest service's months, naming that service (answer 2);
  - going at the shop's opening time on the due day, or the next open day
    (answer 4).
- **One per bike (answer 3):** a new collection of the bike drops the
  reminder still waiting from its earlier visit.
- **Checked again when due.** It doesn't go if any of these is true:
  - the customer no longer says yes;
  - the message is off;
  - the bike was brought back (the work reopened, or collected again
    since);
  - the bike has a booking waiting (answer 3).
- **Its words are written when it goes (answer 1):** the shop's wording,
  the customer's name and their chosen way of contact as they are then.
- **Reopening a collection drops it.**

## Capabilities

### Modified Capabilities

- `messages`: the service reminder.

## Out of scope

- **"Stop these" and its page:** the next piece (answer 5).
- **The reminder's booking link landing,** with the bike and service
  chosen: not decided.
- **The Settings › Messages heading** "Bringing customers back" with its
  note, the fixed "Stop these" line in the wording box, and the service
  box's "The wording is in…" line: the next piece.
- **The tick on the in-shop ready page** (answer 8): a piece of its own.
