## 1. Cycle to Work's own line in the accounts summary

- [x] 1.1 Tests first: a day with a hand-over files the provider share under `money:c2w`, gift card money under Gift cards, and balances (`tests/accounts-send.test.js`); the money lines listed include "Cycle to Work (owed by providers)" after Gift cards (`tests/accounts-software.test.js`). Watch each fail on the old code.
- [x] 1.2 `moneyBucket` returns `c2w` for "Cycle to Work · " tenders; `MONEY` in `summary.js` and `lines.js` gain the line.
- [x] 1.3 The money lines listed in `reports-accounts-and-reopen`'s accounts-software spec include the new line.
- [x] 1.4 Record Jack's answer in `docs/decisions/decided-while-building/2026-11-jack.md` and `openspec/changes/cycle-to-work/tasks.md`.
- [ ] 1.5 `/review`, the `risky-area-reviewer` agent, lint, `npm test`, `npm run test:browser`, CI run by hand on the branch, then archive as the last commit.
