# The bike tag, printed through the browser

## Why
Workshop day 4 (27 Sep) makes the bike tag a Code 128 barcode that matches a bike to its job. The print agent that was to print it (WP-1.11) isn't built. Jack asked for it to print through the browser for now, as receipts do (21 Oct, `docs/decisions/2026-10-21-bike-tag.md` answer 1). He approved the drawings with one change: a button beside the customer row's buttons rather than a strip (answer 2).

## What changes
- Once the bike is in the shop, the job page has a printer button, "Print bike tag", beside Message (drawn as `job-book-in-print`).
- Pressing it prints the tag on the computer's own printer. The tag has the job number large, its Code 128 barcode, the customer and the bike (drawn as `job-bike-tag`).
- The tag is a stand-in until a template builder for receipts and tags exists (Jack, answer 2).
- Receipt printing's "draw into #wh-print, then print" is shared by both.

## Impact
- Code: `src/screens/diary/bike-tag.tsx` (new), `src/screens/diary/job-dialog.tsx`, `src/screens/till/receipt.tsx` (the shared print).
- Tests: `tests/screens/bike-tag.test.js`.
- No server change.
