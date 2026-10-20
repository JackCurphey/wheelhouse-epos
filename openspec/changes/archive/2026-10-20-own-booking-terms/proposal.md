# Proposal: a shop's own booking terms, in Settings

## Why

`bk-settings` draws a "Booking terms" row — "Wheelhouse's standard terms · a copy is kept with each booking" — with "Use your own". What "Use your own" opens isn't drawn; Jack's 8 Oct answer for it (`docs/decisions/2026-10-08-not-drawn-pages.md` row 95, answer C) is a form box on `bk-settings`, following a pattern already built and logged. The server already keeps a shop's own terms (`workshop_settings.booking_terms`, piece 11), serves them to customers, and saves a copy with each booking (`workshop_jobs.terms_text`). Jack, 20 Oct: "1" (this piece next).

## What Changes

- **Settings › Workshop › Online booking**, under a "Terms" sub-heading as drawn: the Booking terms row.
  - Standard terms: "Wheelhouse's standard terms · a copy is kept with each booking", and **Use your own**, which opens a box filled with the standard terms to edit from.
  - Own terms: "Your own terms · a copy is kept with each booking", the box with them, saved when left (the settings pattern), and **Go back to Wheelhouse's standard terms**.

## Lane, work package, drawings and decisions

- **Work package:** WP-4.4 (bk-settings), taken early. **Lane:** Jack's screens; no server change.
- **Drawings:** `bk-settings` (the Terms row); the box follows the Additional note on the confirmation and Messages' "Go back to Wheelhouse's wording".
- **Decisions:** `2026-10-08-not-drawn-pages.md` row 95 (answer C); Book a repair decision 11 and piece 11 (the standard terms).

## Out of scope

- Legal advice: the standard terms are Claude's plain-English draft, approved 26 Sep, not legal advice; a shop's own terms are its own.

## Impact

- `src/screens/settings/settings-page.tsx`; tests
