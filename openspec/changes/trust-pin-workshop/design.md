# Design: Trust PIN on the workshop computer

## The contract

Staff routes, under the request's row-level security.

**Migration 103** (`server/migrations/103_trust_pin.sql`; 102 is #569's),
safe to run twice:

- `shops.trust_pin`, true or false, false to start.
- `shops.workshop_idle_minutes`: 5, 10, 15 or 30, or null for Off; 10 to
  start. It applies only with trust PIN on.
- `pin_checkins.by_tap`, true for a check-in made by tapping a name, false
  for one made by typing a PIN (every check-in before 103).
- `employees.pin_set_at`, when the person's PIN was last kept; null for a
  PIN kept before 103.

**The settings.**

- `GET /api/signing-in-settings` → `{ trustPin, workshopIdleMinutes }`.
  Anyone signed in reads it.
- `PUT /api/signing-in-settings` `{ trustPin?, workshopIdleMinutes? }` →
  the same. The Owner only (403 `owner_only`); 400 for anything but true
  or false, or 5, 10, 15, 30 or null. The shop's row is read `FOR UPDATE`
  in a transaction before it is written; the reply comes after `COMMIT`.

**The idle time.** `trustPinHere()` (`server/till/this-workshop.js`)
is the request's shop's time: 10 with trust PIN off; with it on, the time
chosen, or null (never). `currentCheckin` ends a workshop computer's
check-in unused for that time, as it did at a fixed 10 minutes; the
Owner's own check-in after `ownerIdleMinutes()`, 10 minutes at most
(decision 8).

**The check-in.**

- `GET /api/till-checkin` gains `idleMinutes` (that time, for the screen)
  and `names: [{ id, name, role }]`: on a workshop computer with trust PIN
  on, the people a tap would check in (below); otherwise none.
- `POST /api/till-checkin/tap` `{ employeeId }` → 201 `{ serving }` and the
  check-in cookie, as a PIN does, the check-in marked `by_tap`. Refused:
  403 `not_a_workshop` anywhere but a workshop computer; 403
  `trust_pin_off`; 403 `not_typed_here` for anyone else; 400 for an id that
  isn't a whole number. Whoever was checked in on this browser stops, as
  with a PIN.

**Who a tap checks in.** Someone active, with a PIN, who isn't the Owner,
with a check-in made by typing their PIN (`by_tap` false) on this
workshop computer on the shop's day, after their PIN was last cleared. The
tap locks the shop's row (`FOR SHARE`) and the person's row (`FOR UPDATE`)
in one transaction, checks, ends the old check-in, records the new one and
commits before replying, so trust PIN switched off or a PIN cleared at the
same moment can't slip in between.

## Decisions

1. **Stored on the shop's row**, as the float and the stock amount (#569),
   until the settings store (WP-1.2). One setting for the whole business
   (shops and sites 1), not per site.
2. **The server decides the time**, every time it asks who is checked in,
   so a change counts at once; the screen reads it with the check-in
   (every minute) and goes back at the same time. Off means never, on the
   server and the screen.
3. **The Owner is never a name to tap** (decided here, for Jack to
   overrule). Roles and switches 3 says Owner and Manager pages still ask
   for that person's PIN every time; that isn't built (2.5), and on a
   workshop computer the Owner's pages follow the Owner working
   (workshop-computer design 9). A tap that made the Owner the one working
   would open the Owner's pages, this setting among them, with no PIN.
   So the Owner types their PIN until 2.5. Managers aren't stored yet.
4. **Only a typed PIN earns a tap.** A check-in made by a tap doesn't count
   as having typed a PIN there, so the names are always people who typed
   their PIN on that computer today; and clearing a PIN takes the person
   off the names.
5. **"Who's working?" shows whenever nobody is working** on a workshop
   computer with trust PIN on and a name to tap: after it is left alone,
   and after Switch (stage-1 gaps 10: "Switch opens the existing Enter
   your PIN screen (with trust PIN on, the names to tap)"). With no names
   yet it is Enter your PIN.
6. **"Who's working?" says only what works** (the pattern of
   workshop-computer design 5): the drawn "Owner and manager pages still
   ask for your PIN." waits for 2.5; the line is "You’ve typed your PIN here
   today, so just tap your name." Each name shows Mechanic or Staff, as the
   till's "Who’s getting a PIN?" does, until roles. "Someone else — enter
   your PIN" shows the PIN pad in its place.
7. **The Signing in fold speaks of workshop computers only**, since the
   till's pills (2.4) aren't built. Words, from the drawn lines on
   `set-till-quick`: "Trust PIN"; "Once someone has typed their PIN on a
   workshop computer today, they tap their name instead. The owner still
   types theirs. One setting for the whole business."; then, with it on,
   "Go back to the start when left alone" with "5 minutes", "10 minutes",
   "15 minutes", "30 minutes" and "Off", saved when chosen; with it off,
   "Workshop computers go back to Enter your PIN after 10 minutes left
   alone." The fold's summary: "Trust PIN off", or "Trust PIN on · back
   after [n] minutes", or "Trust PIN on · never goes back".
8. **The Owner's own check-in on a workshop computer waits 10 minutes at
   most** (the review, 29 Oct), or the shop's time if shorter, whatever the
   setting, and `GET /api/till-checkin` tells the screen the same. With Off
   or 30 minutes, an Owner who walked away would otherwise leave their pages
   to whoever is next, the hole decision 3 closes for taps. It lasts until
   Owner pages ask for a PIN every time (task 2.5).
