# Design: The shared workshop computer, first part

## The contract

Staff routes, under the request's row-level security.

**Migration 101** (`server/migrations/101_workshop_computers.sql`; 100 is
`jack/till-setup`'s), safe to run twice:

- `workshop_computers`: `id`, `shop_id` (the request's shop by default),
  `site_id` (the shop it stands in), `name` (optional, up to 60 characters),
  `browser_token_hash` (unique), `active` (true), `created_at`. Row-level
  security as `tills`.
- `pin_checkins.workshop_computer_id`, the workshop computer a check-in was
  made on, null elsewhere, set to null if the row is ever deleted; and
  `pin_checkins.last_active_at`, when the person last did something there.

**The workshop computer's cookie.** `wh_workshop`, HttpOnly, SameSite=Lax,
Secure over HTTPS, 400 days, renewed whenever it is read, holding a key of
the browser's own; only its hash is stored. Like the till's (`wh_till`), it
only says which workshop computer a signed-in browser is and opens nothing
by itself. `thisWorkshop(req)` (`server/till/this-workshop.js`) is the
active workshop computer whose hash matches, in the request's shop, or null.

- `GET /api/till-setup` gains `thisWorkshop: { id, name, siteName } | null`.
- `POST /api/till-setup/workshop` `{ siteId, name? }` → 201 `{ workshop: {
  id, name, siteName } }` and the cookie. The Owner only (403 `owner_only`);
  403 `not_owner_checked_in` as for a till; 409 `already_a_till` when this
  browser is a till, 409 `already_a_workshop` when it is a workshop
  computer; 400 for a site that isn't the shop's or a name over 60
  characters. A blank name is none.
- `POST /api/till-setup` gains 409 `already_a_workshop`.
- `GET /api/till-checkin` gains `workshop: { name, siteName } | null` and
  renews `wh_workshop` when it matches. On a workshop computer
  `checkedInToday` is that computer's check-ins today and `givePin` is
  always empty (giving a PIN is the till's).
- `POST /api/till-checkin` records the workshop computer, and
  `last_active_at`, on the check-in.
- `POST /api/till-checkin/active` → 200 `{ serving }`: on a workshop
  computer, while this browser's check-in still counts, its
  `last_active_at` becomes now. Elsewhere it changes nothing.
- `currentCheckin` counts a check-in only on the workshop computer it was
  made on (and a till's only on its till, as now). **On a workshop computer
  a check-in last used 10 minutes ago or more is ended there and then and
  counts as none**, so every route that asks who is checked in (the
  check-in itself, the float check, giving a PIN, setting up a till) gets
  nobody.

## Decisions

1. **A workshop computer has its own table, not a kind of till.** A till
   has a number, an offline key, a float check and a line on Today; a
   workshop computer has none of them, so nothing about tills changes.
   *Pattern:* migration 100's browser key and `thisTill`.
2. **The idle time is enforced by the server.** The check-in records when
   it was last used; the server ends it 10 minutes later, whatever the
   screen does. The screen counts a press, a click, a tap, a key or a scroll
   as using it and tells the server at most every 30 seconds; it also goes
   back to Enter your PIN by itself at 10 minutes, and the check-in is read
   again every minute, so a screen that missed it catches up. Reading the
   check-in doesn't count as using it. 10 minutes is fixed: trust PIN (which
   alone makes it a setting, roles and switches 9) isn't built, so every
   shop has it off. *Pattern:* the check-in's own cookie and day.
3. **Only workshop computers go back by themselves.** Tills stay checked in
   until someone checks out (roles spec section 6).
4. **Before anyone is working, every page is Enter your PIN.** The PIN
   screen takes the place of the whole staff frame, as drawn (the bar, no
   sidebar). The address stays, so the PIN opens the page that was asked
   for; the front page opens the diary (third walk answer 8: "its keys lead
   to the diary"). What was on screen but not saved is not kept: pages save
   as they go. *Pattern:* the till's PIN screen in place of the till.
5. **The bar says only what works**: "Workshop computer", "[site] · [shop]",
   and "Nobody working — enter your PIN" ("Nobody working" on a phone); no
   Online pill (the till bar's isn't built either). The screen drops the
   drawn line "What you do on this computer is recorded under your name and
   role.": until task 3.8 the server records the sign-in, not the person
   working. *Pattern:* 28 Oct, PINs entry 8, show only what works.
6. **"Working: [name] · Switch" across the top of every page** (stage-1
   gaps 10), as drawn in the job pop-up: Switch ends the check-in and shows
   Enter your PIN. "Now working: [name]" is read out once to a screen
   reader after the PIN.
7. **Set up offers "A till" or "A workshop computer"** (stage-1 gaps 4),
   as pills like the shop's, the till first and chosen. With the workshop
   computer chosen: no till number; the heading "Set up a workshop
   computer"; the line "This computer becomes a workshop computer: staff
   work on it with their PIN."; and "Make this computer a workshop
   computer". Not drawn; decided here for Jack to overrule.
8. **Pages on a workshop computer are the sign-in's**, as on a till today:
   Owner and Manager pages asking for a PIN (stage-1 gaps 1) and pages by
   the person working's role need roles (WP-1.1) and task 3.8.
