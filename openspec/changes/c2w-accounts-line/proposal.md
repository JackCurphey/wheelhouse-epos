WP: none (Jack's answer to merge-c2w's Q1, the accounts half, 14 Nov)

## Why

A Cycle to Work hand-over's provider share is owed by the provider, not taken in the shop. The accounts summary sent to Xero still filed it under Gift cards, because `moneyBucket` in `server/accounts/summary.js` sends every way to pay it can't place there. Jack answered merge-c2w's Q1, the accounts half, on 14 Nov: option 2. Cycle to Work money gets its own line, "Cycle to Work (owed by providers)", the same way online money has one. That matches the cycle-to-work change's reports spec ("Cycle to Work in the accounts mapping") and the drawing `rp-accounts-map` (`reports.mjs`, "Money taken goes to").

## What Changes

- The accounts summary files the "Cycle to Work · [provider]" ways to pay under a new money line, `money:c2w`, "Cycle to Work (owed by providers)", instead of Gift cards.
- "Which Xero account each line goes to" lists the new line under "Money taken goes to", after Gift cards, where the drawing puts it. The screen draws whatever lines the server lists, so the row appears with no screen code change.
- A shop already connected sees one more line with no account chosen. A day with Cycle to Work money is not sent ("Cycle to Work (owed by providers) has no Xero account chosen") until one is chosen, then goes, as with any line.
- No database change: account choices are rows keyed by the line's name, so the new line is new rows only, and no existing row changes.
- Not changed: days already sent (a sent summary is kept as it was sent); the "Cycle to Work commission" and "Cycle to Work shortfalls" rows of the cycle-to-work spec, which stay with that change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `accounts-software`: Cycle to Work money has its own line in the summary and in the account choices. (Its main spec is still in the open `reports-accounts-and-reopen` change; this change adds a requirement of its own and updates that change's list of money lines to match.)

## Impact

- `server/accounts/summary.js` (`moneyBucket`) and `server/accounts/lines.js`: money and the accounts summary, so a risky area.
- `tests/accounts-send.test.js`, `tests/accounts-software.test.js`.
- `openspec/changes/reports-accounts-and-reopen/specs/accounts-software/spec.md`: the money lines listed.
- Records: `docs/decisions/decided-while-building/2026-11-jack.md` and `openspec/changes/cycle-to-work/tasks.md`.
