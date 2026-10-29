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
- **Any later request** from a sign-in, the Owner's or a staff member's,
  that carries a valid key of one of this shop's workshop computers that is
  on, while the session isn't marked yet, marks it (`ownSignInHere`, once a
  request). This covers a session
  that signed in on the workshop computer after it was set up, a WorkOS
  sign-in, and sessions from before 105.
- A mark is never cleared or moved: a session marked with one workshop
  computer stays that computer's. It ends with the session: signing out
  deletes the session row (`POST /api/auth/logout`), and so does its 30 days
  running out.

Staff sessions are marked too (the review of #578, 1): the same rule holds
the sign-in's own PIN and settings, which every sign-in has. A session from
before 105 on a workshop computer is unmarked until its first request with
the key; the screen calls `/api/auth/me` as soon as it loads, so that
window is short (Jack's section of `decided-while-building.md`).

## 3. The rule (`ownSignInHere`, `server/lib/workshop-owner.js`)

One helper decides both the Owner's pages (`ownerHere`) and the sign-in's
own PIN and settings (`ownAccountHere`, Your settings' PIN routes and the
float check's look at closing; the review of #578, 1). Inside the request's
shop:

1. **A marked session** is its own (for the Owner, counts as the Owner) only
   when the person checked in by PIN on this browser is the sign-in's own
   team member and that check-in was made on the marked workshop computer. The cookies don't open it: with `wh_workshop`
   deleted or changed, no check-in on the marked computer can be found, so
   it is locked; a till's key is ignored (a workshop computer is never also
   a till, `ALREADY_A_WORKSHOP`). A marked computer that has since been
   removed is locked the same way (#575, 29 Oct answer 3).
2. **An unmarked session** is as before: with a till's key it is its own;
   with no workshop key it is its own, unless it is a removed workshop
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

## 5. No remembered WorkOS session on a workshop computer (the review of #578, 2)

WorkOS remembers a person's session and may offer a one-press Continue, so
someone at a workshop computer with every cookie deleted could get a fresh,
unmarked Owner sign-in. So when a WorkOS sign-in is marked as a workshop
computer's (at setup or its first request there), its WorkOS session is
ended at WorkOS from the server: `POST /user_management/sessions/revoke`
with `session_id`, authorised with the API key as a Bearer token
(workos.com/docs/reference/user-management/session/revoke, checked 29 Oct:
"Revoke a user session"). Wheelhouse's own session stays signed in; its
`workos_session_id` is cleared once WorkOS takes the revoke, so signing out
there later has no WorkOS session to end. The revoke runs on its own,
never inside the request (the review of the retry, #578): a request may be
inside a transaction holding row locks and its pooled connection, and
WorkOS may be slow, so the answer never waits for it, and the session's
`workos_session_id` is cleared on its own pool connection once WorkOS
answers. A 4xx other than 429 counts as over (the session is unknown or
already ended; WorkOS's reference doesn't say which status that gets, and
its errors page, workos.com/docs/reference/errors, has 404 "The resource was
not found"), so it is cleared and not tried again. Not reached, 429 or a
5xx is logged and the WorkOS session stays; a later request from that
sign-in tries again, at most once a minute for a session, so an outage
doesn't add a call to every request (the re-review of #578). Signing
out still ends it as before. The pretend WorkOS answers the revoke and keeps nothing.

WorkOS's reference doesn't say in so many words that revoking stops its
hosted page offering Continue; it says the revoke ends the user session
that "is created when a user signs in through AuthKit". Checking it against
Jack's Staging account is logged for Jack.
