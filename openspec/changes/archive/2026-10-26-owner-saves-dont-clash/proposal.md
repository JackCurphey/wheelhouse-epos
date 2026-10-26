# Proposal: the Owner's saves made at once both stay

## Why

`more-saves-dont-clash` (archived 26 Oct) listed six saves with the same fault
it fixed, left because only the Owner, or stock ordering, makes them. Each one
reads the record, changes the fields sent and writes every field back, with
nothing stopping a second save in between, so the later write puts back the old
value of whatever the other save had just changed. Tested here, two saves of
different fields at once lost one of the two:

- **A workshop service** (`PUT /api/workshop-services/:id`): a reminder and a
  place in the list, 29 rounds out of 30.
- **A service group** (`PUT /api/workshop-service-categories/:id`): a name and
  a place, 30 of 30.
- **A mechanic's time off** (`PUT /api/workshop-unavailability/:id`): a reason
  and an end time, 30 of 30.
- **A person on the team** (`PUT /api/employees/:id`): a name and working
  days, 30 of 30.
- **A supplier** (`PUT /api/suppliers/:id`): a contact name and a phone
  number, 30 of 30.
- **A draft stock order** (`PUT /api/purchase-orders/:id`): a reference and
  notes, 30 of 30. Its "only a draft can be edited" check is also made on the
  order read before the save starts: an order marked as ordered while an edit
  was on its way still had its notes and lines replaced (tested: the edit was
  answered 200, not refused).

## What Changes

- Each of the six saves reads its record again `FOR UPDATE` inside a
  transaction and merges the fields sent into that, so a second save waits for
  the first and starts from what it wrote. The reply is sent after `COMMIT`.
- The stock order's draft check is made again on the locked row, so an order
  marked as ordered in between is refused with the same words as before.
- Every check on what is sent, its order and its words, and which shop's
  records a save can reach, stay as they are. A refused save writes nothing.

## Capabilities

### Modified Capabilities

- `settings`: a workshop service, a service group, a mechanic's time off and a
  person on the team, saved twice at once, keep both saves.
- `deliveries`: a supplier and a draft order saved twice at once keep both;
  an order marked as ordered while an edit waits refuses the edit.

## Work package, owner, risky areas

A fix found in review (the "Not covered" list of
`openspec/changes/archive/2026-10-26-more-saves-dont-clash/design.md`), not a
work package; Jack's lane. No migration, no `server.js`, no messaging core, no
sign-in. Risky area: money and stock — the stock order save is stock ordering
(it never changes `stock_qty`; it replaces a draft's lines), and its locks are
checked against booking a delivery in (`design.md`). It wants `/review`
before merging. No drawing or decision changes; this follows the pattern built
in `settings-saves-dont-clash` and `more-saves-dont-clash`.

## Out of scope

- Telling someone that another person changed the same field at the same
  time: for one field, the later save still wins, as before.
- `PUT /api/sale-documents/:id` (money): the same pattern, left for sales' own
  review (listed in `design.md`).
- Checks across two different records that could change at once (a service
  included in a full service while it is itself made a full service); listed
  in `design.md`.
