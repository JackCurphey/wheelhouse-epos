# Design: till PINs and the PIN check-in

## The contract

All routes are staff routes, under the request's row-level security, and
need a signed-in staff session (the till computer's sign-in).

**Migration 097** (`server/migrations/097_pins_and_checkin.sql`), safe to run twice:

- `employees.pin_offer_hash TEXT`, `employees.pin_offer_at TIMESTAMPTZ`: the
  PIN Wheelhouse has just shown someone, hashed, until they keep it.
  (`employees.pin_hash` is migration 036's.)
- `pin_checkins`: `shop_id`, `employee_id` (who checked in; deleted with
  them), `login_id` (the sign-in of the computer it was typed on),
  `token_hash` (the browser's check-in cookie, hashed; unique), `day` (the
  shop's own date), `checked_in_at`, `ended_at` (Switch, or someone else
  checking in on that browser). Row-level security as 095.
- `float_checks.employee_id` (who checked the float, from the check-in;
  null for a look at closing; set to null if that person is deleted).

**Routes**

- `GET /api/your-settings/till-pin` → `{ canHavePin, hasPin }`. `canHavePin`
  is false for a sign-in with no team member, other than the Owner's.
- `POST /api/your-settings/till-pin/offer` → 201 `{ pin }`, `Cache-Control:
  no-store`: four digits nobody else at the shop has. Each call replaces the
  last offer ("Give me a different one"). 429 `slow_down` after 10 offers a
  sign-in in 10 minutes. The Owner with no team member gets one first,
  marked as taking payments (two offers at once make one). 409
  `no_team_member` otherwise.
- `POST /api/your-settings/till-pin` `{ pin }` → 200 `{ hasPin: true }`:
  keeps the offered PIN. 400 `no_offer` unless `pin` is the PIN offered in
  the last 15 minutes; 409 `pin_taken` if someone kept it meanwhile.
- `POST /api/team/:id/clear-pin` → 200 `{ ok: true }`, and that person's
  check-ins end. The Owner only, never their own (roles 5); 404 for nobody.
- `PUT /api/employees/:id/pin` (migration 036's, the Owner typing a PIN) is
  removed (Jack, 28 Oct, answer 2).
- `GET /api/till-checkin` → `{ serving: { id, name } | null, checkedInToday:
  [{ id, name }] }`.
- `POST /api/till-checkin` `{ pin }` → 201 `{ serving }` and the
  `wh_till_checkin` cookie. 400 `wrong_pin`, "That PIN isn’t anyone’s — try
  again", for four digits nobody has; 400 for anything else; 429 `slow_down`
  for a second try from the same browser while one waits (decision 3).
- `POST /api/till-checkin/end` → 200 `{ serving: null }` and the cookie
  cleared.
- `GET /api/float-check`: `takesPayments` is the checked-in person's when
  there is one. `POST /api/float-check` records the checked-in person; a
  morning check without a check-in is 409 `check_in_first`; a look at
  closing (`atClose`) needs none. `checkedByName` is the checked-in person's
  name, or the sign-in's.

## Decisions

1. **PINs are four digits, picked by Wheelhouse, unique in the shop**
   (signing in 4 and 7). The server draws a random one with
   `crypto.randomInt` and tries again while it matches anyone else's, then
   shows it once. Keeping it checks again, under a lock for the shop, so two
   people keeping the same PIN at once can't both have it.
2. **Stored only hashed.** PBKDF2-SHA256, 100,000 rounds, a salt per PIN, the
   format of `server/till/pin.js` that the offline till will check. The
   server hashes off the main thread (the async form), since a check-in
   tries the PIN against everyone's. No PIN is written to a log or sent back
   except the one being offered, to its own person.
3. **No lock after wrong PINs** (signing in 8; roles 2), but guessing is
   slowed (Jack, 28 Oct, answer 1): after 10 tries in 10 minutes at one
   shop, each further try waits 3 seconds. Each try is counted before its
   PIN is checked, and a right PIN is taken off the count. The wait is one
   at a time per sign-in and browser, so a burst from one browser gets at
   most one try through every 3 seconds and another till isn't held up.
   The right PIN still works. Nobody sees a "locked" message.
7. **Known limit:** the offline copy carries every cashier's PIN hash
   (`server/till/snapshot.js`), which a till token's holder could try
   offline. Left for step C (`decided-while-building.md`, 28 Oct, 6a).
4. **A check-in lasts the shop's day, on that browser, for that sign-in.**
   The cookie holds a random token; only its hash is kept. It stops at
   Switch, when someone else checks in on that browser, at the end of the
   shop's day, or if the browser's sign-in changes. Until named tills, this
   is what "the till" is.
5. **The float check follows the check-in** (Jack's answer 3, 27 Oct): the
   pop-up shows only once someone has checked in, and asks that person.
6. **The Owner gets a team member for their PIN.** A PIN belongs to a team
   member (till-only people have no sign-in); an Owner with only a sign-in
   is added to the team, as taking payments, when they first get a PIN.
   Other sign-ins with no team member can't have a PIN until the Owner adds
   them (Staff and roles, WP-1.1).
