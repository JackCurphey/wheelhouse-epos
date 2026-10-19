# Proposal: switching between a set time and the whole day

## Why

Jack, 19 Oct (`docs/decisions/2026-10-19-retire-old-workshop-settings.md`
answers 2, 9 and 10; the 24 Sep decision: a change of mode takes effect from
a date the shop chooses, and bookings keep their shape). The server already
schedules a change (`nextBookingMode`, `nextBookingModeFrom`); there is no
screen for it.

## What Changes

- **Settings › Workshop › Online booking:** "How bikes are booked in", "Bikes are booked in for: A set time / The whole day", with the drawn note.
  - Choosing the other one opens "Book bikes in for the whole day?" (or "…for a set time?"), "From a day you choose": "Starting on" a date, "Tomorrow at the earliest", the drawn note, Cancel or "Change from [day]" (`bk-settings-mode-change`).
  - Once chosen, the section says "Changing to the whole day from [day]. Bookings already made keep their set times." with "Cancel the change" (`bk-settings-mode-scheduled`).
  - "Drop-off window", from and to, while bikes are (or will be) booked in for the whole day (`bk-settings-whole-day`).
- **No server change:** `PUT /api/workshop-settings` already takes `nextBookingMode` + `nextBookingModeFrom` (tomorrow or later; both null cancels) and `dropoffWindowStart`/`End`.

## Lane, work package, drawings and decisions

- **Work package:** an early piece of WP-5.1 (Settings › Workshop › Online booking).
- **Lane:** Jack's screens only (`src/screens/settings/settings-page.tsx`).
- **Drawings:** `bk-settings-mode-change`, `bk-settings-mode-scheduled`, `bk-settings-whole-day`, `bk-settings-reserve` (`book.mjs`).
- **Decisions:** `2026-10-19-retire-old-workshop-settings.md` answers 2, 9 and 10; `2026-09-23-book-journey-routing-and-modes.md` (24 Sep).

## Out of scope

- Deposits and the other drawn Online booking rows; per-site modes (WP-1.4).

## Impact

- `src/screens/settings/settings-page.tsx`; `tests/screens/settings-page.test.js`; a browser test
