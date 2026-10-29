# Design: The Tills list, with Rename and Remove

## 1. Who registered it (migration 104)

`tills.registered_by_login_id` and `workshop_computers.registered_by_login_id`,
both `INTEGER REFERENCES logins(id)`, null for those set up before 104.
`POST /api/till-setup` and `POST /api/till-setup/workshop` fill it with the
Owner's sign-in. Re-claiming a till number (28 Oct entry 16) keeps the
till's first registration. Added with `ADD COLUMN IF NOT EXISTS`, so it is
safe to run twice; both tables keep their row-level security.

## 2. The contract

All Owner only (403 `owner_only`, as Set up this till). The writes are
also refused with 403 `not_owner_checked_in` while someone other than the
Owner is checked in by PIN on the computer making the change (the giverHere
rule, `someoneElseCheckedIn`; roles and switches 2).

- `GET /api/till-setup/list` →
  `{ tills: [{ id, code, name, siteName, registeredAt, registeredBy }], workshopComputers: [{ id, name, siteName, registeredAt, registeredBy }] }`.
  Only those switched on; tills in number order (`TILL_ORDER`), workshop
  computers in the order they were set up. `registeredBy` is the sign-in's
  name, or null.
- `PUT /api/till-setup/tills/:id` `{ name }` → 200 `{ id, code, name }`;
  `PUT /api/till-setup/workshop/:id` `{ name }` → 200 `{ id, name }`. The
  name is trimmed; blank is none (null); over 60 characters or not text is
  400. A till or workshop computer that isn't there, is another shop's, or
  is switched off is 404.
- `POST /api/till-setup/tills/:id/remove` → 200 `{ id, active: false }`;
  `POST /api/till-setup/workshop/:id/remove` → the same. Switched off, not
  deleted: its check-ins, float checks and Today's line stay (28 Oct entry
  17), and a till's number stays in use (entry 7). Its browser stops being
  it at once (`thisTill` and `thisWorkshop` read only those switched on).
  Already off is 404.

Each write is `BEGIN`, the row `SELECT … FOR UPDATE` where it is on,
the `UPDATE`, `COMMIT`, and the reply only after `COMMIT`; a refusal rolls
back. So a rename and a remove at once queue, and a rename after a remove
is 404 rather than renaming a till that's off.

The older `POST /api/tills/:id/deactivate` (the offline core's) stays for
its callers, but goes through the same switch-off as Remove: locked, refused
while someone else is checked in here, 404 when already off (the review,
29 Oct). The screen uses the new route.

## 5. A removed workshop computer stays closed (the review, 29 Oct)

A workshop computer's Owner sign-in counts as the Owner only while the Owner
is the person working there (workshop computer design 9). Once it is
removed, its browser still carries the old key; read as "no workshop
computer", that browser would get every Owner page with no PIN. So a key
that points at one of this shop's removed workshop computers counts as
**not the Owner**: Owner-only routes refuse it, as when a mechanic is
working. Signing in again on that browser (the WorkOS callback) clears the
old key, and the Owner is the Owner there again; nobody is locked out for
good. A removed till changes nothing here (a till's key never changed who
counts as the Owner). Stricter than needed until Jack says otherwise
(`decided-while-building.md`, the Tills list, entry 9).

After a remove, as before: the till's offline key is refused on
`/api/till/:slug/*`, check-ins made there no longer count, and a trust-PIN
tap there is refused, because each reads only those switched on.

## 3. The screen

Settings › Front desk › Till › Tills, Owner only, as drawn in
`set-till-tills-owner`:

- A row per till: "Till B1" (and " · Front counter" when it has a name),
  then "Bolton · registered Tue 1 Sep by Jack Lewis" (without "by …" when
  not known), Rename, Remove.
- A row per workshop computer the same way, titled "Workshop computer"
  (and " · [name]").
- Then the drawn note and "Make this computer a till", as now.
- **Rename** opens a box, as Customer groups' Edit does: title "Rename Till
  B1", "Name (optional)" with the name, Cancel and Save. A refusal shows in
  the box.
- **Remove** opens `set-till-remove`'s pop-up: "Remove Till B1?", "Bolton",
  the drawn note, "Keep the till", "Remove the till". It does not close on a
  click outside it (destructive). For a workshop computer: "Remove the
  workshop computer?", "This computer stops working as a workshop
  computer.", "Keep the workshop computer", "Remove the workshop computer".
- After a change every query is read again, so a computer that has just
  stopped being a till or workshop computer finds out at once.
- The fold's summary stays the tills' codes, as now.

## 4. Gaps the drawings leave

Logged in Jack's section of `decided-while-building.md`: the name in the
row's title; the Rename box; workshop computers in the same list and their
pop-up's words; the date's form; "by [name]" left off when not known.
