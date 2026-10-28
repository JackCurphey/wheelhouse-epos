# Tasks

## 1. Server and screens (one pull request, `jack/give-pin-at-till`)

- [x] 1.1 Record Jack's approval of the drawings as answer 5 in `docs/decisions/2026-10-28-answers.md`
- [x] 1.2 Tests first (`tests/give-pin-at-till.test.js`): who is listed (no PIN, active, not the giver, not the Owner, this shop only; empty unless the Owner is serving); the offer and keep for another person (the checked-in Owner only, never the giver's own or the Owner's, nobody with a PIN, another shop's person not found, no-store, hashed, unique under the lock, 15 minutes, the shared limit); keeping ends the check-in. Watch each fail
- [x] 1.3 Tests first (`tests/screens/give-pin-at-till.test.js`, `tests/browser/give-pin-at-till.spec.ts`): Serving stays one tap with nobody to give to; the menu with one person and with several; Who's getting a PIN?; [Name]'s till PIN, Give me a different one, Keep this PIN back to Enter your PIN; Close; the drawn No PIN yet line. Watch each fail
- [x] 1.4 Build the server (`server/routes/till-pins.js`) and the screens to the drawings
- [x] 1.5 Route list and the owner-only allow-list
- [x] 1.6 Break each key rule on purpose, see its test go red, and restore
- [x] 1.7 Log choices in Jack's section of `decided-while-building.md`; lint, typecheck, `npm test`, `npm run test:browser`; self-review (sign-in)
- [x] 1.8 `/opsx:archive` as the last commit, before merging
