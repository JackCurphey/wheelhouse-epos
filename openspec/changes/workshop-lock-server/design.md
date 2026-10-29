# Design: The workshop computer's Owner lock, held on the server

## 1. Migration 105

`sessions.workshop_computer_id INTEGER REFERENCES workshop_computers(id)`,
null for a session that has never been used on a workshop computer.
`ADD COLUMN IF NOT EXISTS`, so safe to run twice. `sessions` is the sign-in
registry (no row-level security); a shop's removal deletes its sessions
before its workshop computers (`server/remove-shop.js`), so the reference
never blocks it.

## 2. When a session is marked

- **Setting up**: `POST /api/till-setup/workshop` marks the request's
  session with the new workshop computer, in the same request that sets the
  cookie. A session that began on an ordinary browser becomes the workshop
  computer's here.
- **Any later request** from an Owner's sign-in that carries a valid key of
  one of this shop's workshop computers that is on, while the session isn't
  marked yet, marks it (`decide()`, once a request). This covers a session
  that signed in on the workshop computer after it was set up, a WorkOS
  sign-in, and sessions from before 105.
- A mark is never cleared or moved: a session marked with one workshop
  computer stays that computer's. It ends with the session: signing out
  deletes the session row (`POST /api/auth/logout`), and so does its 30 days
  running out.

Only the Owner's sessions need the mark, since only they can count as the
Owner; marking happens where the Owner's sign-in is decided.

## 3. The rule (`decide()`, `server/lib/workshop-owner.js`)

For the Owner's sign-in, inside the request's shop:

1. **A marked session** counts as the Owner only when the person checked in
   by PIN on this browser is the Owner and that check-in was made on the
   marked workshop computer. The cookies don't open it: with `wh_workshop`
   deleted or changed, no check-in on the marked computer can be found, so
   it is locked; a till's key is ignored (a workshop computer is never also
   a till, `ALREADY_A_WORKSHOP`). A marked computer that has since been
   removed is locked the same way (#575, 29 Oct answer 3).
2. **An unmarked session** is as before: a till's key counts as the Owner;
   no workshop key counts as the Owner, unless it is a removed workshop
   computer's key (#575); a workshop computer's key marks the session (2)
   and then follows rule 1.

So deleting the cookie can only lock the session further, never open it.
The way out is signing out, as for a removed workshop computer.

## 4. Gaps

- **Local development's automatic sign-in** (`WHEELHOUSE_DEV_AUTOLOGIN`,
  off unless asked, refused in production and on the hosted copy) has no
  session row, so it can't be marked; there the lock still follows the
  cookie. Logged.
- **The screen** still reads `workshopComputer` in `/api/auth/me` from the
  cookie: with the cookie deleted it shows the ordinary app, but every Owner
  page and route is refused (`isOwner` is false). No screen change.
- **Staff sessions** (not the Owner's) aren't marked: they never count as
  the Owner, so the lock doesn't apply to them.
