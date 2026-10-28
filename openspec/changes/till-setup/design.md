# Design: Set up this till, check-ins per till, and the till's name

## The contract

Staff routes, under the request's row-level security.

**Migration 100** (`server/migrations/100_till_setup.sql`; 098 is main's,
099 is `jack/stock-take`'s), safe to run twice: `tills.name` may be empty
(the drawing's "Name (optional)"); `tills.browser_token_hash`, the hash of
the browser's own token, unique when set; `pin_checkins.till_id` and
`float_checks.till_id`, each the till it was made on, null for a browser
that isn't a set-up till, set to null if a till row is ever deleted. All
three tables already have row-level security (036, 095, 097).

**The till's cookie.** `wh_till`, HttpOnly, SameSite=Lax, Secure over HTTPS,
400 days (the longest a browser keeps one), holding a token of the
browser's own; only its hash is stored, in `browser_token_hash`. It is never
the offline till's token (`token_hash`, the Bearer the snapshot and sync
routes take), and the offline token is never put in a cookie: the browser
token only says which till a signed-in browser is, so copied out of the
browser it opens nothing without a staff sign-in (review, 28 Oct). How the
offline till gets its own token is step C's to decide; setting up a till
here stores an offline token's hash that nobody is shown. `thisTill(req)`
(`server/till/this-till.js`) is the active till whose browser hash matches,
in the request's shop, or null: a switched-off till, another shop's till, an
offline till's token or a made-up one is no till. Tills are listed in
number order (B2 before B10), on Today and in Settings.

- `GET /api/till-setup` → `{ sites: [{ id, name, code, taken: [number] }],
  thisTill: { id, code, name, siteName } | null, tills: [code] }`. The Owner
  only (403 `owner_only`). `taken` is every number used at that site,
  switched off or not (codes stay unique); `tills` the active tills' codes.
- `POST /api/till-setup` `{ siteId, number, name?, reclaim? }` → 201 `{ till:
  { id, code, name, siteName } }` and the cookie. The Owner only (403
  `owner_only`); 403 `not_owner_checked_in` when someone other than the
  Owner is checked in on this browser by PIN (`giverHere`'s rule); 409
  `already_a_till` when this browser is one; 400 for a site that isn't the
  shop's, a number outside 1 to 99, or a name over 60 characters; 409
  `taken` for a number in use, also when two set up the same number at once.
  A blank name is stored as none. With `reclaim: true` and that number an
  active till at that site → 200 with that till: this browser gets a new
  browser token for it, so the browser that had it stops being it (a lost
  cookie, or a replaced computer); its name stays. Server only until drawn.
- `GET /api/till-checkin` gains `till: { code, name, siteName } | null`, and
  renews the `wh_till` cookie whenever it matches; `checkedInToday` is this
  till's check-ins today (for a browser that isn't a till, the check-ins
  made on browsers that aren't).
- `POST /api/till-checkin` records this browser's till on the check-in.
  `currentCheckin` counts a check-in only on the till it was made on.
- `GET /api/float-check` and `POST`: the check gains `tillCode` (null when
  counted on a browser that isn't a till, or the Owner's look at closing,
  even checked in on a till); the POST records the till of the person's
  check-in.
- `GET /api/needs-attention`: `float_short` and `float_over` gain `tillCode`.
- `GET /api/today/tills` → `{ tills: [{ code, openedAt, openedBy, floatCheck }] }`
  (was `{ till }`): one per active till, and one per till switched off but
  used today, in number order, plus one with `code: null`
  when no till is set up or something was done today on a browser that isn't
  one. Each line's `openedAt`/`openedBy` is its own first check-in today; the
  day's float check is on the line it was counted at.

## Decisions

1. **The till is kept in its own cookie, separate from the sign-in.** Signing
   out or a different person signing in on that computer leaves it a till;
   another shop's sign-in doesn't see it (row-level security). The cookie
   holds the browser's own token, never the offline till's (review, 28 Oct:
   the offline token opens the till's copy of every customer and PIN hash,
   and takes sales, with no sign-in). Step C decides how the offline till
   gets its own token. The cookie is renewed each time the till is read, and
   the Owner can re-claim a till number for a new computer (server only).
   *Pattern:* the check-in cookie (`wh_till_checkin`) and migration 036's
   hashed till token.
2. **A browser that isn't set up still works as the till, as today**, with
   check-ins that belong to no till; it keeps "Till" without a number on
   Today. Making setup the only way to a till is step C's (the till's own
   sign-in). *Pattern:* show only what works; nothing that works today stops.
3. **A check-in belongs to the till it was made on.** After "Make this
   computer Till B1", whoever was checked in on that browser checks in again.
   Who's in on Today stays the whole shop's: it is about who is at work.
4. **One float check and one close a shop a day, as now.** Cash-up decision 6
   says each till closes on its own, but neither sales record knows which
   till a sale was on, so a till's own drawer can't be worked out; the float
   check records where it was counted, so its line and Today's say "Till B1".
   Close the day keeps no till name, since it counts the whole shop's cash.
5. **Till numbers as pills**: 1 up to three, or one past the highest taken,
   whichever is more; taken ones "In use"; the lowest free one chosen. The
   drawings: Bolton with none taken shows B1, B2, B3; [Second site] with 1
   and 2 taken shows [code]1 and [code]2 In use and [code]3.
6. **Only what works**: the setup's sentence drops "it stays signed in, works
   offline" (step C) and the name's hint about receipt numbers (receipts
   aren't numbered by till yet). A business with no site (WP-1.4 gives every
   business its first) sees no "Make this computer a till", and the setup
   page says so instead of empty pills.
7. **The Owner only, signed in**, until roles bring managers: registering a
   till is never offered by PIN (roles and switches 2), and the till's
   check-in grants nothing here. When someone other than the Owner is
   checked in on that browser by PIN, the Owner's sign-in alone doesn't set
   up a till there (review, 28 Oct; `giverHere`'s rule). Decided for Jack.
8. **Re-claiming a till number is server only.** The drawing's taken numbers
   are "In use" and can't be picked, so no screen offers it; it waits for a
   drawing (a lost cookie or a replaced computer).
9. **The Owner's look at closing records no till**, even when the Owner is
   checked in on one: closing is the whole shop's.
