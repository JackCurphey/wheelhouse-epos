# Design: the Owner's saves made at once both stay

The six saves listed under "The same fault, not fixed here" in
`openspec/changes/archive/2026-10-26-more-saves-dont-clash/design.md`. Each one
had the fault; none was left. Line numbers are main's before this change.

1. **The pattern, copied from the two earlier changes.** The record is looked
   up first, so a missing one is a 404 before the body is read, as before.
   The body is read before the lock, so a slow upload never holds the row.
   Then `BEGIN`; the record is read again `SELECT … FOR UPDATE` (repeating
   the 404 for one removed in between); the fields sent are merged into that
   row and checked; the `UPDATE` runs; `COMMIT`; the reply is read and sent
   after it. A refusal runs `ROLLBACK` and sends the same status and words as
   before. Anything thrown runs `ROLLBACK` with `.catch(() => {})` and is
   rethrown. A second save waits on the row lock, then starts from what the
   first wrote.
2. **The checks are unchanged, in the same order with the same words.** Only
   where they read the stored row from has moved: the locked row instead of
   the one read before.
3. **Workshop services** (`server/routes/workshop-settings.js:857`; the
   unlocked read at `:860`). The Services box sends the name and price every
   time and leaves out what it doesn't show (whether it is active, bookable
   online, its questions, place, reminder and what a full service includes),
   and those were kept from the unlocked read. The checks (name, price,
   minutes, reminder, kind and group, questions, includes, "is part of …")
   moved into the transaction unchanged; they already ran before `BEGIN` and
   read only the database.
4. **Service groups** (`workshop-settings.js:784`, read at `:787`): name and
   place, merged by `readCategoryBody`.
5. **A mechanic's time off** (`workshop-settings.js:613`, read at `:615`):
   merged with `{ ...toBlock(row), ...body }`. The clashes it reports are
   still worked out after `COMMIT`.
6. **A person on the team** (`server/routes/team.js:187`, read at `:190`):
   name, mechanic, cashier, working days.
7. **Suppliers** (`server/routes/suppliers.js:77`, read at `:79`). A name
   another supplier has fails the `UPDATE` on the unique name; the catch rolls
   back and sends the same 400.
8. **Stock orders** (`server/routes/purchase-orders.js:312`, read at `:315`).
   Two faults: supplier, reference and notes merged from a read outside the
   transaction it writes in; and the draft check (`:317`) made on that read,
   so an order marked as ordered while an edit waited still had its notes and
   lines replaced. Both now use the locked row; the early draft check stays,
   so an order already sent is refused before its body is read, as before.

## Locks and stock

Booking a delivery in (`bookIn`, both receive routes) locks orders
`FOR UPDATE` in id order, then their lines, then products in id order with an
`UPDATE` (as a sale does, `server/lib/sales.js`). The order save now locks one
order, then deletes and inserts that order's lines; the line inserts check the
product with a foreign-key share lock, which a sale's or a delivery's
`FOR NO KEY UPDATE` on that product doesn't block. It never locks a product
and never waits on anything booking in holds after locking its order, so the
two can't deadlock. Booking in refuses a draft once it holds the order, so a
delivery against an order being edited waits for the edit and then is refused,
as it was before for a draft. Marking as ordered and cancelling are one
`UPDATE` each with the status in the `WHERE`; they wait for the edit and then
check the row it wrote.

The same holds for the other five: after taking its one row lock, each save
waits on nothing but foreign-key share locks (a supplier, a product, a service
group, an included service, a mechanic), and nothing holding those rows waits
on the row locked here.

Read from the code, not tested: `FOR UPDATE` blocks a foreign-key check on
the locked row for as long as the save takes (a few milliseconds), where the
earlier one-statement `UPDATE` took the weaker `NO KEY UPDATE` and didn't. So
a booking that names a mechanic, or a job line naming a service, waits for an
Owner's save of that mechanic or service to finish. One way this could
deadlock: two individual services each made a full service including the
other, at the same moment. Each locks itself, then the include row's foreign
key check waits on the other; Postgres refuses one with a deadlock error
(a 500) and the other saves. Before this change both saved, leaving two full
services that include each other, which the include check is meant to stop.

## Shop isolation

Unchanged. Every locked read is the same lookup by id under the request's
row-level security, with `FOR UPDATE` added; it can only see, and lock, the
session's own shop's record. Each test checks that another shop's record is
the same after all its rounds, and a last test that another shop's six
records are 404 and unchanged.

## Not covered

- `PUT /api/sale-documents/:id` (`server/routes/sales.js:310`, money): status,
  title, note, customer and job merged into a read with no lock, and the "only
  while open" check on that read. Not touched; sales need their own review.
- Checks across two records that could change at once: a service made a full
  service while a full service is being saved to include it (the "is part of"
  check reads the include list without locking it), and an included service
  changed to a full service while another save includes it. The service's own
  row lock doesn't cover the other service. Seen in the code, not tested.

## Decision log

- All six fixed (brief: fix each that really has the fault). Each failed its
  test before the fix: service 29 of 30 rounds, the other five 30 of 30, every
  save answered 200; the order's draft check answered 200, not 400.
- `FOR UPDATE`, as the two earlier changes, rather than `FOR NO KEY UPDATE`
  (which a sale uses on products): the brief asked for the same pattern; the
  cost is the short foreign-key wait described under "Locks and stock".
- The order save's line checks (`loadPoLineItems`) and supplier check moved
  inside the lock, so the checks keep their order (draft, supplier, lines). They
  read only the database.
- The refused-save test first stayed green with a refusal's `ROLLBACK` removed:
  the request's connection rolls back a transaction left open, so nothing was
  written either way. It now also checks that the server never logged
  "request finished with a transaction still open", and goes red without the
  `ROLLBACK`.
