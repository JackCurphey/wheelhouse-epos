# Design: The Working pills on the workshop computer

## The contract

No migration. Staff routes, under the request's row-level security.

- `GET /api/till-checkin` gains `trustPin` (true or false), the shop's
  setting. `names` is unchanged: on a workshop computer with trust PIN on,
  who a tap would check in (trust-pin-workshop: this computer, a typed PIN
  today, this sign-in, never the Owner, the PIN not cleared or changed since).
- A pill is `POST /api/till-checkin/tap` `{ employeeId }`, unchanged: it
  ends whoever was working on this browser and checks the person in, or is
  refused with its own codes.
- "Someone else" is `POST /api/till-checkin/end`, as Switch.

## Decisions

1. **The strip is the drawing's**: "Working:" in small muted words, then
   the pills in a row that scrolls sideways when it doesn't fit, the person
   working highlighted (dark, `aria-pressed="true"`), the others plain,
   then "Someone else" (no pressed state), in a group named "Who’s working".
   It sits at the bottom of the page column, beside the sidebar on a
   computer, and stays on screen as the page scrolls (`sticky`), so it never
   covers the page's own last lines.
2. **The pills are `names`, with the person working added** when they aren't
   among them (the Owner, who is never a name to tap, trust-pin-workshop
   design 3; or someone whose PIN changed since). Their pill is highlighted
   and does nothing when tapped. *Pattern:* the drawing highlights the
   person working.
3. **A pill tap uses the tap route**, so every rule of "Who's working?"
   holds, and the page stays as it is. A refused tap says why above the
   pills, inside the strip, in the server's words, and the pills are read
   again.
4. **"Someone else" ends the check-in and shows the PIN pad**, not "Who's
   working?": the person pressing it has said they aren't on the list.
   *Pattern:* "Someone else — enter your PIN" on "Who's working?".
5. **With trust PIN on, the strip replaces the Working bar** (roles and
   switches 9; stage-1 gaps 10's bar stays with trust PIN off). "Now
   working: [name]" is still said to a screen reader.
