# WP-0.2, server half: the recorded booking bugs

**Stage 0, line 2 of the split plan's §9** (`docs/superpowers/plans/2026-10-04-release-2-two-person-split.md`),
Mark's lane. Jack's screens half (Back while "Sending…" keeps the private
link; a retry sends the same request key) starts once this merges and
builds against the contract below.

## Intent

Four bugs recorded during the booking build, fixed on the server:

1. **A shop's website address shows another shop's booking page.** On
   `<a>.wheelhouseepos.com` (or any request the website handler takes),
   `/book/<b>` serves the booking app for shop B.
2. **"Today" starts at UTC midnight.** The sales list (`?date=today` or a
   date) and the dashboard work out the shop's date correctly, then compare
   `created_at` with that date at UTC midnight. In British Summer Time a
   sale at 00:30 counts as the day before.
3. **A lost reply makes a duplicate booking.** If the reply to a saved
   booking never arrives and the customer sends again, a second job is made.
   The server now accepts each request once, keyed by a request key the
   client repeats on every retry.
4. **A `null` body gives a 500.** The booking route reads fields straight
   off the body, so `null` (or any non-object) throws.

## Contract

### `POST /api/portal/:shopSlug/bookings`

Who may call it: anyone (a guest), or the shop's signed-in customer. No
change.

Request: today's `BookingBody` (`src/screens/book/details-rules.ts`) plus
one optional field:

| Field | Type | Rule |
|---|---|---|
| `requestKey` | string | 32 to 128 characters, letters, digits, `-` and `_` only. The client makes one when the customer presses Send (`crypto.randomUUID()` fits) and sends the same key on every retry of that booking. A new booking gets a new key. |

Optional for now, so today's screens keep working until Jack's half sends
it. Without a key, a retry still makes a second booking.

Replies:

| Case | Status | Body |
|---|---|---|
| A new booking | 201 | `BookingReply`, unchanged |
| The same key again, with the same booking details | **200** | `BookingReply` for the booking already made. `privateLink` is the **same** link as the first reply: a booking sent with a key gets a link worked out from the key, so every reply to it carries the same one. Nothing is written, no second customer is made, and the early replay doesn't count against the guest rate limit. |
| The same key again, with different details | 409 | `{ error: 'This booking was already sent with different details', code: 'reused_key' }` |
| A `requestKey` that breaks the rule above | 400 | `{ error: 'Invalid request key' }` |
| A body that isn't a JSON object (`null`, a list, a number, a string) | 400 | `{ error: 'Invalid request body' }` |

"The same booking details" means the whole body apart from `requestKey`,
compared by a SHA-256 hash of its JSON. The key is stored as a SHA-256 hash
too. The link code is SHA-256 of `booking-link:` plus the key, and like any
link only its hash is stored. That's why the key must be at least 32
characters: the link is only as hard to guess as the key.

Types, in `src/lib/api/types.ts` until WP-0.4 moves them into the per-area
file: `BookingRequestKey` (`{ requestKey?: string }`, which Jack's half adds
to `BookingBody`), and `'reused_key'` added to `ApiErrorBody`'s `code`.
`BookingReply` stays where it is, in `src/screens/book/send.ts`; its shape
doesn't change.

No live-update events and no Today needs-attention kinds (they start at
WP-1.9 and WP-1.10).

Test data Jack's browser tests need: nothing new. Any shop with a bookable
service and a mechanic (`tests/helpers/bookable.js`) is enough. To test a
retry, send the same body and key twice.

### `/book/*` on a website address

On a request the website handler takes (`<slug>.<base domain>`, `/store/<slug>`
or `?storefrontSlug=<slug>`), `/book/<slug>` and everything below it serves
the booking app only when `<slug>` is that website's own shop. Any other
slug gets `404 { error: 'Storefront not found' }`, the same answer an
unknown or switched-off website gets. `/book` with no slug is unchanged.

### `GET /api/sales?date=…` and `GET /api/dashboard`

No change of shape. A day now runs from midnight to midnight on the shop's
own clock (`workshop_settings.time_zone`, migration 033), summer time
included.

## Approach

- One migration, `039_booking_request_key.sql`: two nullable text columns on
  `workshop_jobs` (`booking_request_key_hash`, `booking_request_body_hash`)
  and a unique index on `(shop_id, booking_request_key_hash)` where the key
  is set. The table's row-level security already covers them.
- The route checks the body is an object, then checks the key **before**
  anything else is validated or written. A retry of a saved booking would
  otherwise be refused, because its own slot is now taken.
- Two retries can arrive at once. The key is checked again first thing
  inside the booking lock, so the second finds the first. The unique
  indexes are the last guard: the key's (039), or the link's (027), since
  the link comes from the key. Either is answered as `reused_key`. In that
  race the second request may already have made a guest customer row and
  counted against the guest rate limit. That's the same kind of stray row
  the archive already records for refusals inside the lock.
- Why the link comes from the key (fresh review, 5 Oct): the first version
  issued a new link on every replay. A slow first request that replayed
  after its retry would then replace the link the customer had just been
  given, leaving them with one that no longer works.
- `/book/<slug>` is checked in `handleStorefrontRequest`, beside the code
  that forwards `/book` to the booking app.
- The sales and dashboard windows become
  `created_at >= (?::date)::timestamp AT TIME ZONE ?` and
  `created_at < (?::date + 1)::timestamp AT TIME ZONE ?`, with the shop's zone.

## Found while doing this, not fixed here

On a website address, `/api/portal/*` returns the website's HTML, so the
booking app served there can't reach the booking API. Hosting isn't chosen
and no website is live, so this goes in the decision log for WP-0.5 or the
website stage, not into this pull request.

## Tests (written first, each watched failing)

- `tests/portal-booking-request-key.test.js`: a retry with the same key
  returns 200, the same reference and the same working link, and there's
  still one job; three at once make one job and one link; a different body with the same
  key is 409 `reused_key`; a bad key is 400; no key still books twice; a
  `null`, list or number body is 400.
- `tests/book-page.test.js`: another shop's `/book/<slug>` on a website
  address is 404, and the website's own shop still gets the app.
- `tests/shop-day-window.test.js`: on the pinned clock (1 Sep 2026, UK), a
  sale at 23:30 UTC on 31 Aug counts as today, and one at 23:30 UTC on 1 Sep
  doesn't, in both the dashboard and `/api/sales?date=today`.
