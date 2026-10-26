# Design: more saves made at once both stay

1. **Lock the record, as the settings saves do.** Each save runs in a
   transaction and reads its record `SELECT … FOR UPDATE`; the fields sent are
   merged into that row, checked, and written. A second save waits on the row
   lock, then reads what the first wrote. Narrowing each write to the sent
   columns was not chosen: the customer save checks `active` against
   `merged_into_id` and the job save checks the sent fields against the stored
   ones (on offer, complete), so they need a row nobody else is changing.
2. **The body is read before the lock**, and the record is still looked up
   first so a missing one is a 404 before the body is read, as before. The
   locked read repeats the 404 for one removed in between.
3. **Customers** (`server/routes/customers.js`, `saveCustomer`): the merge, the
   checks and the write moved unchanged into `saveCustomer`, which returns a
   `{ status, body }` refusal or nothing. The group list is written in the same
   transaction. The 200 is sent after `COMMIT`.
4. **Bikes** (`PUT /api/bikes/:id`): the same, inline.
5. **Products** (`server/routes/products.js`, `saveProduct`): the same; a
   duplicate SKU or barcode is still a 400 with the same words, and rolls back.
   The Shopify sync now runs after `COMMIT`, so the lock is never held while it
   waits on the network, and compares against the row read under the lock.
6. **Workshop jobs** (`server/routes/workshop.js`, `saveJob`): the save already
   took the booking lock for the job's days and re-read the job `FOR UPDATE`,
   but merged the fields into the copy read before the lock. It now runs under
   `withJobBookingLock` (the helper moving a later day uses): that reads the
   job's days, locks them and the day it is moving to, re-reads the job
   `FOR UPDATE`, and locks again if the job moved in between. `saveJob` merges
   into, and checks against, that row. The checks and their order are
   unchanged, the version check still comes after them, and the day locks
   still go in date order. A sent date that isn't a date isn't locked; the
   check refuses it as before.
7. **Shop isolation is unchanged.** Every locked read is the same lookup by id
   under the request's row-level security, with `FOR UPDATE` added; it can only
   see, and lock, the session's own shop's record.

## Not covered

### Fixed elsewhere or not this fault

- `PUT /api/workshop-jobs/:id/parts/:partId`: needs the version and checks it
  under the lock, so a second save is refused, not lost.
- `PUT /api/workshop-jobs/:id/checklist/items/:index`,
  `PUT /api/workshop-jobs/:id/storage-slot`, `PUT /api/portal/:shopSlug/me/contact`,
  `PUT /api/employees/:id/pin`, `PUT /api/sale-documents/:id/items/:itemId/progress`:
  one statement setting only what was sent.
- `PUT /api/workshop-checklists/:id`: already reads `FOR UPDATE`.
- `PUT /api/customer-groups/:id`: a name is needed on every save and every
  caller (Settings › Payments, the old app) sends the name and the discount
  together, so nothing is merged in practice.
- `PUT /api/sale-documents/:id/items`: replaces the whole list.

### The same fault, not fixed here (saves only the Owner, or stock, makes)

- `PUT /api/workshop-services/:id` (`server/routes/workshop-settings.js:857`):
  the Services box leaves out what it doesn't show (whether it's active, its
  questions, its place and what a full service includes), and those are kept
  from a row read with no lock.
- `PUT /api/workshop-service-categories/:id` (`workshop-settings.js:784`): name
  and position.
- `PUT /api/workshop-unavailability/:id` (`workshop-settings.js:613`): a
  mechanic's time off, merged with `{ ...toBlock(row), ...body }`.
- `PUT /api/employees/:id` (`server/routes/team.js:187`): name, mechanic,
  cashier, working days.
- `PUT /api/suppliers/:id` (`server/routes/suppliers.js:77`).
- `PUT /api/purchase-orders/:id` (`server/routes/purchase-orders.js:180`):
  supplier, reference and notes merged from a read outside the transaction it
  writes in; the draft check is on that read too.

### Money, for its own review

- `PUT /api/sale-documents/:id` (`server/routes/sales.js:310`): status, title,
  note, customer and job are merged into a read with no lock, and the "only
  while open" check is on that read. A save racing the order being completed
  could write `open` back over it. Not touched here: sales need their own
  review.

## Decision log

- Lock rather than narrow the write (1), as the settings change did.
- Four fixed, the rest listed (brief: about four, the ones most likely to be hit
  by two people at once — till, customers, workshop). The six listed above are
  Owner-only settings or stock ordering.
- The job save moved onto `withJobBookingLock` rather than adding a third read:
  it already handles a job that moves between reading its days and locking them.
- Shopify sync after `COMMIT` (5): an outside call must not hold a row lock.
- The refused-save test first only checked for a 400; with the date check
  broken on purpose it still passed, because the shop-closed check also refuses
  `nonsense` with a 400. It now checks each refusal's words.
