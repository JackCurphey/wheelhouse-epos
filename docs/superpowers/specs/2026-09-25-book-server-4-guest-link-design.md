# Book server work, piece 4: the private booking link

**Changed by piece 7** (`2026-09-26-book-server-7-multiple-services-design.md`):
the link returns `services` (a list of `{name, price}`) and `totalPrice`, not
a single `serviceName`.

**Date:** 2026-09-25. **Approved in session by Jack** (design, 25 Sep, in
three parts).
**Serves:** the "Keep your private progress link" promise on book screen
`pending` (06), "View my booking" on `confirmed`, and the `expired` branch.
**Part of:** the server prerequisite work for journey plan 4a
(`docs/superpowers/plans/2026-09-20-phase-4a-book.md`, item 3 gap table: "a way
for a guest to read the request back"). Piece 4 of six. Pieces 1-3 and 3b are
merged (#64-#68). Piece 5 (service questions) and 6 (customer uploads) are out
of scope.

## Decisions this rests on (Jack, 25 Sep)

1. **View only.** The link shows the booking. Cancel, date change, quote
   approval, messages and preferences through the link are later work (the
   Release 1 plan puts cancel, reschedule and expiry in P05b).
2. **Every online booking gets a link**, guest or signed in. One path, and the
   confirmation screen behaves the same for everyone.
3. **The link works until 30 days after the booked date.** Worked out at read
   time from `job_date`, not stored, so moving the booking moves the expiry.
4. **The code is stored scrambled (hashed); the shop makes a new link** rather
   than looking up the old one. A new link switches the old one off.
5. **One field on the booking**, not a separate links table. A booking has one
   current link.
6. **The customer's own words are kept apart from staff notes** (Jack, 25 Sep,
   raised while planning). Today the description is saved into
   `workshop_jobs.notes`, which staff edit (`PUT /api/workshop-jobs/:id`). The
   link shows a separate copy that no staff route writes, so a staff comment
   can never reach the customer. Bookings made before piece 4 show none.

## What is built

### Storage (migration 027)

- `workshop_jobs.link_token_hash TEXT`, nullable, with a unique index where
  not null. Holds the SHA-256 hex digest of the code; the code itself is never
  stored.
- `workshop_jobs.customer_description TEXT`, nullable. What the customer wrote
  when booking online, written once by the booking route and by nothing else.

### The code

- 32 random bytes from `crypto.randomBytes`, as 64 hex characters. SHA-256 is
  enough because the code is long and random; it is not a password, so a slow
  hash adds nothing.
- The link's path is `/book/<shopSlug>/booking/<code>`. The page at that path
  is a screen, built later with the customer screens (routing decision J1,
  `docs/decisions/2026-09-23-book-journey-routing-and-modes.md`).
- A small module, `server/booking-link.js`, holds the pure parts: make a code,
  hash a code, build the path, and decide expiry from a job date and today.

### Issued on booking

- `POST /api/portal/:shopSlug/bookings` stores the hash and the customer's
  description on the new job in the same insert, and the 201 response gains `privateLink` (the path). This is
  the only time the code is returned by that route.
- Applies to guest and signed-in bookings alike.

### Read back: `GET /api/portal/:shopSlug/booking-links/:code`

No sign-in. The shop comes from the slug, and the lookup runs under that
shop's row-level security, so a code from another shop's booking finds
nothing.

- **200** with:
  - `reference`
  - `shopName`
  - `jobDate`, `startTime` (empty for an untimed booking)
  - `serviceName` (from `service_id`; null for "not sure" and for bookings
    made before piece 3b)
  - `description` (from `customer_description`; null for bookings made before
    piece 4)
  - `bike` (`make`, `model`), or null
  - `stage`: one key for where the booking is up to. The page turns it into
    words; the wording is decided with the page.

    | Job state | `stage` |
    |---|---|
    | booking `pending` | `awaiting_confirmation` |
    | booking `reschedule_requested` | `change_requested` |
    | booking `declined` | `declined` |
    | booking `expired` | `request_expired` |
    | booking `cancelled` | `cancelled` |
    | booking `scheduled`, custody `expected` | `confirmed` |
    | custody `in_shop`, work not `complete` | `in_workshop` |
    | custody `in_shop`, work `complete` | `ready_to_collect` |
    | custody `collected` | `collected` |

    Booking states other than `scheduled` win over custody and work.
- **Never included:** customer name, phone, email, price, staff notes,
  mechanic notes, customer or job ids.
- **404** "We can't find that booking" for an unknown code, a replaced code, or
  a code from another shop. One answer for all, so guessing teaches nothing.
  An unknown shop slug gets the portal's existing 404 "Shop not found",
  answered before this route runs; shop slugs are public, so it reveals
  nothing about bookings.
- **410** "This link has expired" when today is more than 30 days after
  `job_date`. The `expired` screen needs this told apart from 404.
- **429** after 30 lookups in 15 minutes from one IP, using the existing
  `makeRateLimiter`.

### A new link: `POST /api/workshop-jobs/:id/private-link`

- Staff sign-in required, like the other `/api/workshop-jobs` routes. The job
  is read under the shop's row-level security, so another shop's job is 404.
- The job must have a customer; otherwise 400.
- Makes a fresh code, replaces the stored hash (the old link stops working at
  once), and returns `privateLink` in a 201. Works for any job with a
  customer, including bookings made before piece 4 and jobs staff entered.

## Tests (written first, each seen failing)

- Migration: both columns exist as nullable text, and two jobs cannot share a
  hash.
- A staff edit of the job's notes does not change the description the link
  shows.
- Pure module: code length and randomness, hash is not the code, expiry is
  exactly day 30 inclusive and day 31 expired.
- Booking returns `privateLink`; reading it back returns the booking.
- No row in `workshop_jobs` holds the code itself.
- Wrong code, replaced code, other shop's code: 404, same body.
- A job dated 31 days ago: 410. Moving its date forward: 200 again.
- The read-back body contains no name, phone, email or price (checked against
  the actual values seeded).
- Each `stage` row in the table above.
- Staff: new link works and the old one then gives 404; another shop's job
  gives 404; a job with no customer gives 400; no staff session gives 401.
- The 31st lookup inside the window gives 429.

## Out of scope

- The customer page at `/book/<shop>/booking/<code>` and the staff button for
  "new link". Both are screen changes, brought to Jack separately.
- Sending the link by SMS, email or WhatsApp. No email or WhatsApp provider is
  chosen (STATUS item 4).
- Cancel, date change, quote approval, messages, preferences through the link.
- Revoking a link without issuing a new one.
