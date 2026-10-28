# Design: giving a PIN at the till

## The contract

Staff routes, under the request's row-level security, needing a signed-in
staff session (the till computer's sign-in) and this browser's check-in
cookie (`wh_till_checkin`). No migration: the PIN offer columns are 097's.

- `GET /api/till-checkin` gains `givePin: [{ id, name, role, tillOnly }]`:
  the people the person serving here may give a PIN to. Empty unless that
  person is the Owner. It lists active team members with no PIN, never the
  person serving and never the Owner. `role` is `"Mechanic"` for a
  mechanic, otherwise `"Staff"`; `tillOnly` is true for someone with no
  Wheelhouse sign-in.
- `POST /api/till-checkin/give-pin/:id/offer` → 201 `{ pin }`,
  `Cache-Control: no-store`: four digits nobody else at the shop has, kept
  only hashed as that person's offer. Each call replaces the last ("Give me
  a different one"). Refusals: 403 `not_giver` unless the Owner is checked
  in on this browser; 403 `own_pin` for the giver; 403 `owner_pin` for the
  Owner; 404 for nobody in this shop or someone not active; 409 `has_pin`
  for someone who has a PIN; 429 `slow_down` after 10 offers a sign-in in 10
  minutes (the same count as Your settings').
- `POST /api/till-checkin/give-pin/:id` `{ pin }` → 200 `{ serving: null }`:
  keeps the PIN offered to that person in the last 15 minutes, under the
  shop's PIN lock; then ends this browser's check-in and clears its cookie.
  The same 403s and 404; 400 `no_offer`; 409 `pin_taken` if someone kept it
  meanwhile; 409 `has_pin` if they got a PIN meanwhile.

## Decisions

1. **Giving is the existing offer and keep, for another person.** The
   offer, the keep, the 15 minutes, the uniqueness lock and the hash are
   moved into two shared functions that Your settings and the till both
   call, so the rules can't drift apart.
2. **Only the checked-in Owner gives a PIN, until roles.** The check is on
   the person checked in by PIN on this browser, not the browser's sign-in,
   so a till signed in as Jo still lets the Owner give a PIN once he checks
   in, and a till signed in as the Owner doesn't let Jo. Manager and "Give
   everything a Manager can do" aren't stored yet (WP-1.1); they join the
   same check then (`decided-while-building.md`).
3. **Keeping ends the giver's check-in** on this browser, as Switch does, so
   the person the screen is turned to never ends up serving as the Owner.
   Closing without giving a PIN leaves the Owner serving.
4. **The PIN is never logged** and is sent only in the offer's reply, to
   the browser showing the pop-up. Nothing new is written to the log.
5. **Wrong-PIN tries are unchanged**: giving a PIN types none, and the new
   person's first check-in counts like any other.

## Screens

- `ServingButton` (`src/screens/till/pin-checkin.tsx`): with an empty
  `givePin`, one tap to Switch as built. Otherwise it opens the Serving
  menu: on a computer a small menu under the button (arrow keys, Escape
  back to the button, a click away closes it); on a phone a sheet from the
  bottom headed "Serving: [name]" with Close.
- "Who’s getting a PIN?" and "[Name]’s till PIN": pop-ups like Your
  settings' PIN pop-up, full screen on a phone. The PIN pop-up is shared
  with Your settings (`src/screens/till/pin-offer-dialog.tsx`); the focus
  goes to Keep this PIN when the PIN arrives, and Escape closes it as the ✕
  does.
