# Proposal: the reminder tick on the in-shop ready page

## Why

Account and reminders decision 2 (Jack, 1 Oct): the customer says yes to
service reminders "when booking or collecting". The collection tick is drawn
on the ready page's pay-online card only (`ac-collect-remind`,
`cp-summary-said-yes`, `collect.mjs:77`). That card isn't built.

Jack's answer 8 of 25 Oct (`docs/decisions/2026-10-25-morning-questions.md`):
the in-shop ready page, the one customers see today, gets the same drawn
tick and wording. Then customers who didn't tick it when booking, and those
booked in by staff, can say yes when their bike is ready. Jack's lane.

## What Changes

- **The tick on the in-shop card.** While the bike is ready to collect, the
  "To pay when you collect" card ends with the drawn tick, unticked:
  - "Remind me when my bike is due its next service";
  - "And ask me for a review after I collect. One message each, the way you
    chose when you booked. Stop any time."

  Ticking it saves at once, as a yes from collection.
- **A customer who said yes already** sees the drawn "You’ll get a reminder
  when the next service is due. Change" instead. Change shows the tick,
  ticked; unticking it turns reminders off.
- **The booking link route** says whether the customer said yes, and takes
  their answer.

## Capabilities

### Modified Capabilities

- `book`: the ready page asks about service reminders.

## Out of scope

- The pay-online ready card itself.
