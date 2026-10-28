# Design: Who's in and Tills on Today, and the first PIN by itself

## The contract

Staff routes, under the request's row-level security.

**Migration 098** (`server/migrations/098_first_pin.sql`), safe to run twice:
`logins.till_pin_asked_at TIMESTAMPTZ` (Skip or Keep on the first-time
pop-up) and `employees.pin_cleared_at TIMESTAMPTZ` (set by
`POST /api/team/:id/clear-pin`).

- `GET /api/today/whos-in` → `{ people: [{ id, name, role, checkedInAt }
  | { id, name, role: 'Mechanic', dueAt }] }`, any signed-in staff. `role`
  is `Owner` for the Owner's team member, `Mechanic` for a mechanic,
  otherwise `Staff`. Checked in first, by the time of their first check-in
  today; then the mechanics due today who haven't, by `dueAt` ("HH:MM", the
  start of their first free time today in the diary's capacity). Never a
  PIN, a PIN hash or a check-in token.
- `GET /api/today/tills` → `{ till: { openedAt, floatCheck: { byName, at,
  short, seenByName } | null } }`, the Owner only (403 `owner_only`).
  `openedAt` is the first check-in today, or null.
- `GET /api/your-settings/till-pin/ask` → `{ ask: 'first' | 'cleared' | null }`:
  null for a sign-in with no team member (the Owner's included) or with a
  PIN; `cleared` when the PIN was cleared after the last ask; `first` when
  never asked.
- `POST /api/your-settings/till-pin/ask` → 200 `{ ask: null }`: records the
  ask (Skip for now, or Keep this PIN).

## Decisions

1. **Who's in counts every check-in today**, ended or not (decision 5:
   checking in only records who's in and when; there's no check-out). It
   follows the check-in's shop day, the 28 Oct rule that a check-in covers
   the whole shop until tills have names.
2. **Who's due is the diary's**: active mechanics with free time today in
   the capacity the diary and booking use (working days, the shop's hours,
   time off). Their start time is the start of that free time. Till staff
   have no working hours in Wheelhouse yet, so only mechanics are due.
3. **"Late" is worked out by the page** from its own clock against `dueAt`,
   so it turns without a reload, as Today's Book in does.
4. **One Tills line, no name**, as the float check and Close the day have no
   till name until step C.
5. **The first-time pop-up is for team members**, not the Owner's own
   sign-in (the drawing is Jo's first sign-in after her invite).
6. **Asked once**: Skip or Keep records the ask; clearing a PIN asks again.
   It opens over the page they land on and leaves them there ("then she
   lands in her room", walk-through 4 H1). It reuses the shared PIN pop-up
   (`src/screens/till/pin-offer-dialog.tsx`): no ✕, Escape does nothing.
