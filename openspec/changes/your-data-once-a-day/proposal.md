# Proposal: One copy of your data a day

## Why

"Download a copy of your data" (`your-data-copy`, #587, #588) let each
sign-in take 10 copies in 15 minutes, held in the server's memory. Jack
asked for once a day instead (`docs/decisions/2026-10-30-answers.md`,
answer 2: "Is there a reason that we can't stop them from downloading, say,
more than once a day?").

Work package: **WP-4.5**, slice A, taken by Jack. Nothing of Mark's is needed.

**Risky areas:** a public customer route (`/api/portal/*`). No migration,
money, stock, `server.js` or messaging.

## What Changes

- **One copy per sign-in a day**, the shop's day, counted from the privacy
  requests log (`privacy_requests`, migration 108), so a restart never resets
  it. A second that day is refused before anything is read or logged:
  "You've already downloaded a copy today. You can get another tomorrow."
- **Two requests at once take turns**, so only one gets through.
- **The 10-in-15-minutes limit held in memory is removed.**
- **The account shows the refusal in the server's own words**, in the
  warning bar, with no Try again.

## Drawings and decisions

- Drawings: `ac-download`, `ac-download-failed` (`account.mjs`); the refusal
  isn't drawn, so it uses the drawn warning bar (logged).
- Decisions: Jack's 30 Oct answer 2; account and reminders decision 4.

## Out of scope

- Asking to delete your account and the shop's Privacy requests list (the
  next piece).
