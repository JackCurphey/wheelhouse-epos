# Proposal: more saves made at once both stay

## Why

`settings-saves-dont-clash` (archived 26 Oct) fixed three settings saves that
read a whole record, changed the fields sent and wrote every field back, with
nothing stopping a second save in between. Its design listed other saves as not
yet looked at. Looking at them found the same fault in the saves most likely to
be made by two people at once:

- **A customer** (`PUT /api/customers/:id`): a new phone number and a new note
  saved at once lost one of the two in 29 rounds out of 30.
- **A bike** (`PUT /api/bikes/:id`): a new colour and a new frame number, 29 of 30.
- **A product** (`PUT /api/products/:id`, what the till sells): a new price and
  a new description, 30 of 30.
- **A workshop job** (`PUT /api/workshop-jobs/:id`), saved without the version
  the job's screens send: a new title and a new note, 30 of 30. The screens
  send the version, and a second save with the same version is refused as
  "changed while you were looking", so this loses nothing from today's
  screens; the save still accepts one without a version, and that one lost.

Read from the code, not tested here: the same fault can also undo a removal. A
bike, customer or product removed while someone saves an edit to it would come
back, because the edit writes back the "still here" it read before the removal.
With the lock, the edit starts from the row after the removal.

## What Changes

- Each of the four saves reads its record again `FOR UPDATE` inside a
  transaction and merges the fields sent into that, so a second save waits for
  the first and starts from what it wrote. The reply is sent after `COMMIT`.
- The workshop job's save already locked the job's days and re-read the job;
  it now uses the job read under that lock for the merge and the checks, not
  the one read before it (`withJobBookingLock`, as moving a later day does).
- Every check on what is sent, and which shop's records a save can reach, stay
  as they are. A refused save writes nothing.

## Capabilities

### Modified Capabilities

- `customers`: a customer's or a bike's details saved twice at once both stay.
- `stock`: a product's details saved twice at once both stay.
- `workshop-jobs`: a job's details saved twice at once without a version both stay.

## Work package, owner, risky areas

A fix found in review (the "Not covered" list of
`openspec/changes/archive/2026-10-26-settings-saves-dont-clash/design.md`), not
a work package; Jack's lane. No migration, no `server.js`, no messaging core.
Risky areas: the customer save sets `email_from_customer`, which decides
whether a customer's sign-in by code joins this record (customer accounts,
risky area 3); the statement is unchanged, only the row it starts from. The
product save sets prices but not `stock_qty`; it is not a sale, payment or
refund. Both want `/review` before merging. No drawing or decision changes;
this follows the pattern already built for settings and for moving a job's
later day.

## Out of scope

- Telling someone that another person changed the same field at the same
  time: for one field, the later save still wins, as before.
- Sales, payments and refunds: `PUT /api/sale-documents/:id` shows the same
  pattern and needs its own review (listed in `design.md`).
- The other saves with the pattern that only the Owner makes, listed in
  `design.md` under "Not covered".
