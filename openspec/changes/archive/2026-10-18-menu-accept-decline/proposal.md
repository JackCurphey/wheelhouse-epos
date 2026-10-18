# Proposal: Accept or decline from a booking request's menu

## Why

Jack, 18 Oct (`docs/decisions/2026-10-18-old-diary-features.md` answer 4,
its touch section, and "The menu's till actions wait for the till"): the
old diary's right-click "Approve" becomes "Accept or decline" on a booking
request, opening the request's usual pop-up. "Open in the till" and "Print
receipt" wait for the till, which can't open an order or print a receipt yet.

## What Changes

- A booking request's "Job actions" menu (right-click, press and hold, or
  the Menu key) has "Accept or decline" in place of "Open job". It opens the
  request pop-up (Accept, Another time, Decline), as answering it from
  Waiting for you does. "View overview" stays.
- Other jobs' menus are unchanged.

## Lane, drawings and decisions

- **Lane:** Jack's: `src/screens/diary/job-extras.tsx`, `diary-page.tsx`.
- **Drawings:** `diary-menu-pending` (its till items wait),
  `diary-menu-pending-tablet`, `diary-menu-pending-phone`.
- **Decisions:** as above.

## Out of scope

- "Open in the till" and "Print receipt", until the till can do them.

## Impact

- `src/screens/diary/job-extras.tsx`, `src/screens/diary/diary-page.tsx`,
  `tests/screens/diary-stretch.test.js`
