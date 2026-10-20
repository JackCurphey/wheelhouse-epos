# Proposal: confirming online bookings automatically

## Why

Book a repair decision 8 (Jack, 1 Oct, `docs/decisions/2026-10-01-book-a-repair-review.md`):
confirming online bookings automatically is a shop setting, off by default.
On, "a booking that fits the diary is confirmed when sent — the customer sees
'Booking confirmed' at once and the job sits in the diary as a normal
booking". Every online booking is a request today (`portal.js` always saves
`'pending'`), and nothing stores the setting. Jack, 19 Oct
(`docs/decisions/2026-10-19-auto-confirm.md` answers 1–4): such a booking is
marked "New, booked online" in the diary until someone opens it; drawings
approved; this contract first, Mark's server half, then Jack's screens.

## What Changes

- **Settings › Workshop › Online booking:** "Confirm bookings automatically", a switch, Off to start, saved at once, Owner only; On, the folded summary ends "confirmed straight away" (`bk-settings-auto`).
- **Customer booking, step 4:** with the switch on, the button reads "Confirm booking" and the line "By booking, you agree to…" (`bk-details-auto`); the booking page then shows "Confirmed" (`bk-confirmed`), with the drop-off line and the shop's note.
- **Diary:** a booking confirmed straight away is a normal booking, marked "New, booked online" ("New online" in a narrow week column) until someone opens the job; nothing to answer, and it is not in Waiting for you (`bk-staff-confirmed`).
- **Server:** the setting; a new online booking saved as confirmed when the setting is on; a "not yet seen" flag on such a job, cleared when staff open it; the booking page told which wording to use.

## Lane, work package, drawings and decisions

- **Work package:** WP-4.4 Book a repair, rebuilt (build plan, stage 4: "auto-confirm"), taken early, as the Online booking rows before it.
- **Lane:** Mark's server half first (split plan §4.3, §4.4): migration, `server/routes/workshop-settings.js`, `server/routes/portal.js`, `server/routes/workshop.js`. Then Jack's screens: `src/screens/settings/`, `src/screens/book/`, the diary block in `src/screens/workshop/`.
- **Drawings:** `bk-settings-auto`, `bk-details-auto`, `bk-confirmed`, `bk-staff-confirmed` (`book.mjs`, `diary.mjs`).
- **Decisions:** `2026-10-01-book-a-repair-review.md` decision 8; `2026-10-19-auto-confirm.md` answers 1–4.

## Out of scope

- Deposits (they wait for Mark's payment work, Jack, 19 Oct) and the "Pay £[deposit] and book" button.
- Customer texts and emails ("Booking confirmed" / "Request received"): no booking messages are sent yet.
- Changes to a confirmed booking stay requests, as today (decision 8).

## Impact

- Server: a new migration (the next free number); `workshop-settings.js`, `portal.js`, `workshop.js`
- Screens: `settings-page.tsx`; the step 4 details screen; the diary's job block
- Tests for each
