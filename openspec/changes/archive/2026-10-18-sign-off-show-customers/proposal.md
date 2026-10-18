# Proposal: the mechanic sign-off, piece 3 (showing customers who signed off)

## Why

Jack's 16 Oct answer 3 (`docs/decisions/2026-10-16-mechanic-sign-off.md`):
staff always see who signed a job off; a shop setting, off to start, adds
"Checked by [name]" to the customer's receipt and booking link. Jack chose to
draw it first and approved the drawings on 18 Oct (that file's "Piece 3").

## What Changes

- **The setting.** `workshop_settings.show_sign_off_to_customers` (migration 041, off), sent as `showSignOffToCustomers` by `GET`/`PUT /api/workshop-settings`.
- **A first Settings page.** `/workshop/settings` shows Workshop with its Mechanics section holding "Show who signed off to customers" (drawn as `set-workshop-sign-off`). The rest of Settings comes with WP-5.1.
- **The receipt.** With the setting on, a job's printed receipt says "Checked by [name]" under the job and bike (`till-receipt-paper-checked`), from the till's Paid box and the diary's Print receipt.
- **The booking link.** With the setting on and the bike ready or collected, the link's reply carries `checkedBy` (the name kept with the sign-off), and the page shows "Checked by [name]" in its summary (`cp-summary-checked`'s line, on today's page).

## Lane, work package, drawings and decisions

- **Work package:** WP-4.1 (mechanic sign-off), piece 3; the Settings page is an early, partial piece of WP-5.1.
- **Lane:** screens are Jack's (`src/screens/settings/` new, `till/`, `diary/`, `book/`). **Mark's files, flagged for him** (Jack, 18 Oct): `server/routes/workshop-settings.js`, `server/routes/portal.js`. The migration is a workshop setting.
- **Drawings:** `set-workshop-sign-off` (`setup.mjs`), `till-receipt-paper-checked` (`till.mjs`), `cp-summary-checked` (`collect.mjs`).
- **Decisions:** `2026-10-16-mechanic-sign-off.md` answer 3 and "Piece 3".

## Out of scope

- Turning it on at a real shop: that waits for the solicitor's check (answer 3; `docs/runbooks/go-live-checklist.md`).
- The rest of Settings › Workshop (WP-5.1), the full "ready" booking link page (`cp-summary`), and email receipts.

## Impact

- `server/migrations/041_show_sign_off.sql` (new), `server/routes/workshop-settings.js`, `server/routes/portal.js`
- `src/screens/settings/settings-page.tsx` (new), `src/staff/app-shell.tsx`, `src/screens/till/receipt.tsx`, `till-page.tsx`, `pay-dialog.tsx`, `src/screens/diary/diary-page.tsx`, `sign-off-dialog.tsx`, `src/screens/book/pending.tsx`, `pending-query.ts`
- tests for each
