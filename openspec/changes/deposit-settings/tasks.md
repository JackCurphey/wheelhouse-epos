# Tasks

- [x] 1.1 Server tests first (`tests/deposit-settings.test.js`, `tests/deposit-amount.test.js`): off to start; saved and read back; checks on each value; switched on before the amount (none taken), can't switch on with no provider; the amount rule (percent, several services, rounding, cap, fixed, not known, off). Watch each fail
- [x] 1.2 Migration 069 from empty on a scratch database; `server/payments/provider.js`, `server/workshop/deposit.js`, the settings route. Verify 1.1
- [x] 2.1 Screen tests first: the Deposits part as drawn, rows only while on, % or £, the note only while confirming by hand, the fold's summary, the refusal shown. Watch each fail
- [x] 2.2 Build it; a browser test
- [ ] 2.3 Log what's decided; `/review` (a migration); lint and tests; archive as the last commit
