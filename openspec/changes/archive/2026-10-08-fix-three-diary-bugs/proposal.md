## Why

Writing the workshop-diary spec (8 Oct) found three bugs in the diary's
screens. Jack chose to fix them now (8 Oct: "1"), with the change-request
pop-up's new wording approved by him ("1": the mechanic on each side).
The rest of what the spec found is in issue #192.

## What Changes

- **New job, "Waiting for parts" with "The bike is here now"**: the server
  already puts the bike in the shop as it creates such a job, so the screen
  no longer books it in again. Before, the book-in was refused, the form
  stayed open, and a second Save with Shared queue made a duplicate job and
  order.
- **The change request pop-up** names the mechanic on each side, "Mon 5 Oct
  · 10:00 · Sam" → "Mon 5 Oct · 14:00 · Alex Morgan" ("Shared queue" when
  there is none), and the sentence reads "The customer asked to move this
  booking. Accepting keeps the same work." Before, it said the mechanic
  stays the same while accepting moved the booking to the one asked for.
- **A Week-view drop on the requested time** sends the mechanic the customer
  asked for, so it accepts a change to another mechanic. Before, the job
  moved and the request was left waiting.

Out of scope: the other findings (#192).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `workshop-diary`: "Saving a new job", "The change request pop-up shows
  from and to", "Dropping a job on the customer's requested time accepts the
  change".

## Impact

- Lane: Jack's screens only (`src/screens/diary/`); no server change.
- The drawing of the change request pop-up (`diary.mjs`, request-change)
  still shows the old sentence and no mechanics; it is brought into line
  with the drawings that the stage 1 check listed.
