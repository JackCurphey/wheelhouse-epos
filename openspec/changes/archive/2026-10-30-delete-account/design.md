# Design: Ask us to delete your account, and the shop's Privacy requests

## 1. Migration 109

- `privacy_requests.cancelled_at TIMESTAMPTZ`: when the customer cancelled
  ("Cancel my request"). A request is **open** while `done_at` and
  `cancelled_at` are both null.
- `customers.deleted_at TIMESTAMPTZ`: when the shop deleted their details
  (answer 3.1). A deleted customer is also `active = 0`.
- A unique index: at most one open deletion request per customer
  (`kind = 'delete'`, neither done nor cancelled), so two asks at once make
  one.
- All `IF NOT EXISTS`, safe to run twice; the table keeps its forced
  row-level security (108).

Dates shown are the shop's (`workshop_settings.time_zone`), worked out by
the database: asked on `(asked_at AT TIME ZONE zone)::date`, answer by one
calendar month later (UK data protection), overdue when that day is before
the shop's today. Nothing compares a timestamp in JavaScript.

## 2. What's in the way

Only a bike still in the workshop: a job of theirs (or of a record merged
into theirs) with `custody_state = 'in_shop'` (coverage walks answers 4 and
5; M12: store credit doesn't block). Listed by the job's reference.

## 3. The customer's routes (`server/routes/portal.js`)

Signed in to that shop, from the shop's own pages (403 otherwise, as the
account's other actions):

- `GET /me` gains `deletion: { askedOn, finishBy } | null`, the open
  deletion request.
- `POST /me/delete-request`: records a deletion request (`kind 'delete'`,
  `source 'account'`, the sign-in), or answers with the open one; 200 with
  `deletion`. A bike in the workshop doesn't stop the ask (answer 4).
- `POST /me/delete-request/cancel`: marks the open request cancelled; 200,
  or 404 when there's none open (already done or cancelled).

Both lock the customer row (`FOR SHARE`, as the copy does) inside a
transaction and reply after `COMMIT`.

## 4. The shop's routes (`server/routes/privacy-requests.js`), the Owner only

- `GET /api/privacy-requests`: every request not cancelled, open first
  (oldest asked first), then done (newest first): `id`, `reference`
  (`PR-<id>`), `customerId` and `name` (null once deleted, answer 3.6),
  `kind`, `source`, `askedOn`, `dueBy`, `overdue`, `doneOn`, `inTheWay`
  (open deletion requests only), and `openCount`.
- `GET /api/privacy-requests/open-count`: `{ openCount }` for the Customers
  link; any signed-in staff member.
- `POST /api/privacy-requests/:id/delete`: carries out the deletion (5);
  409 `in_the_way` with the list, 409 `not_open` when done or cancelled,
  404 for another shop's or a copy request.
- `GET /api/customers/:id` gains `deletionRequest: { askedOn, dueBy,
  source, inTheWay } | null` for the customer page line.

## 5. Deleting their details (`server/privacy-requests.js`)

One transaction, every row locked before anything is written, in the order
the rest of the app takes them (the reviews of the server):

1. The merge records naming them (Undo takes its merge record first).
2. Their jobs, `FOR UPDATE` in id order, before their record: a job's own
   routes lock the job and then write for the customer (Mark ready queues
   Bike ready), so the deletion waits for the job rather than holding the
   customer it needs.
3. The customer, `FOR UPDATE`: no new merge into them can start, and a
   sale, payment or booking for them waits (its reference to the customer
   waits on this lock).
4. Every record merged into theirs, however far back (a recursive read,
   done again now the customer is held, so a merge that finished while the
   deletion waited is in), with their merge records, `FOR UPDATE` in id order.
5. Their sign-ins, their jobs read again (one booked while the deletion
   waited is in), then the request.

Then: an open deletion request is required (409 `not_open` otherwise); a
bike in the workshop is in the way (409 `in_the_way`). A till payment holds
the customer and then the job, the other way round: the deletion gives up
any lock it waits on for more than 0.8 seconds, before the database's own
deadlock check (1 second) could cancel the payment, then pauses, tries once
more (logged), and answers 503 `busy` if it still can't. The 30-day merge
clean-up takes its merge record first too (`customer-merge.js`), and skips
one undone or deleted since.

For the customer and every record merged into theirs (answer 3):
- **customers**: name, email, phone, note, address, postcode, company
  fields cleared; every switch off and every yes cleared; `active = 0`,
  `deleted_at = now()`.
- **customer_bikes**: make, model, colour, frame number and notes cleared;
  `active = 0`. The rows stay, for the kept jobs.
- **job_notes**: their conversation with the shop and the notes on their
  repairs, deleted.
- **workshop_job_attachments** sent by the customer (`from_customer`) on
  their jobs: rows deleted; the files removed once the save is released,
  a file that can't be removed logged.
- **customer_messages**: every message the shop sent them (by customer, or
  a receipt for one of their sales), deleted, waiting ones included.
- **customer_merges** naming them, deleted (answer 3.5).
- **customer_logins** and their **customer_sessions**, deleted: the account
  is gone. `pretend_signin_codes` for their email, deleted.
- **reminder_stop_codes**, **shop_message_stops**, **customer_group_members**,
  **customer_not_duplicates**: deleted.
- **till_attention**: an alert about them, as its own record, as the record
  it matched (`matched_customer_id`, migration 109, written by the till's
  sync, and moved by a merge, its Undo and the 30-day clean-up as
  `customer_id` is), or, before that column, by its words ending "customer
  [id]", keeps its row, with the words "Customer details deleted".
- **workshop_jobs.link_token_hash**: cleared, so their booking links stop
  working, a future booking's included.
- **Their words** (answer 4, "Wipe their words"), on each job and the order
  made with it: `customer_description`, `customer_bike_note`, every answer
  and typed word in `question_answers`, the lines the booking wrote in the
  job's `notes` and the order's `note` (`server/workshop/booking-notes.js`,
  each part matched as a whole, however many lines her words ran over, and
  replaced by its one "[removed]" line, in order; a part staff have since
  edited no longer matches and stays),
  and the description in "Online booking: [services] - [their words]" on the
  job's and the order's title, each become "[removed]". What staff typed
  stays.
- **Kept whole**: sales, till sales and their lines and payments, orders
  (`sale_documents`) and their totals, payments, workshop jobs and their
  lines, quotes, the work and the prices.

The request: `done_at = now()`. It keeps its `customer_id` (now a blank
record) for the paper trail, shown by its reference with no name. Signing
in again later with the same email makes a fresh, empty customer.

**After the deletion nothing brings their details back:** staff saving the
customer (Edit, switching them on), adding a bike for them or editing one
of their bikes is refused (409 `deleted`, "This customer's details were
deleted at their request, so they can't be changed."), each under a lock on
the customer, so a save already waiting is refused once the deletion is
in. A booking already under way from their account holds the customer
(`FOR NO KEY UPDATE`, as it goes on to update them, so two of their bookings
at once take turns) inside its own transaction and is refused (401) once the
deletion is in. The account's other actions already under way (adding a
bike, changing How we contact you) and a note through their booking link do
the same: each re-reads and holds the customer in its own transaction (the
link's note holds the job first, `FOR KEY SHARE`, then checks the link is
still theirs: that waits behind the deletion's `FOR UPDATE` but not behind a
merge or its Undo moving the job, so no deadlock with them), and is refused
once the deletion is in.

**Offline tills** (checked, not built): the till's copy (`server/till/snapshot.js`)
lists only active customers, so a deleted one is left out of every new copy;
no till keeps a copy yet (Mark's step C), so whether a till drops a customer
missing from a newer copy is for step C's design (logged).

## 6. The account (`src/screens/book/account.tsx`)

- **Your data card** (`ac-account`): "Download a copy of your data", then
  "Ask us to delete your account"; with a request open: "You asked us to
  delete your account on [date]. We'll finish by [date]." and "Cancel my
  request".
- **The pop-up** (`ac-delete`): "North Street Cycles will delete your
  account within one month, and tell you when it's done.", the drawn note
  on details, bikes, messages and sales, "Want a copy first? Download a copy
  of your data.", "This can't be undone.", "Keep my account" and "Ask to
  delete". With a bike in the workshop (`ac-delete-blocked`): "We'll delete
  your account once your bike has been collected.", the bike and its
  reference, "Call [shop phone] if you need to talk it through." and the
  same two buttons. Sent (`ac-delete-sent`): "Request sent", "… by [date]
  at the latest.", OK.
- **The banner** at the top while open (`ac-account-delete-pending`), with
  "Cancel my request"; cancelled: "Request cancelled — your account stays as
  it is." (`ac-account-delete-cancelled`).

## 7. The shop's screens

- **Customers** (`cs-list`): "Privacy requests · [n] open" at the foot,
  for the Owner.
- **Privacy requests** (`cs-privacy`, `ac-privacy-requests`): back to
  Customers; heading and note as drawn; a row per request: "[name] · Delete
  their details" or "· Copy of their data"; "From their account on the
  website · asked [date] · answer by [date]" ("Overdue · " first when late),
  or "Asked [date] · done [date]" and "Done"; "Still in the way: bike in the
  workshop, [ref]" with Delete held back and "Can be deleted once the bike
  is collected."; a done deletion shows its reference, not a name.
- **Delete their details** (`cs-privacy-delete`): "Delete [name]'s
  details?", "A privacy request asked on [date]", the drawn note, "Keep
  their details" and "Delete their details".
- **The customer page** (`ac-customer-delete`): "Asked to delete their
  account on [date] · from their account on the website · answer by [date].
  Still in the way: …".
