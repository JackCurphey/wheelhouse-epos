# Tasks

## 1. Server and screens (one pull request, `jack/whos-in-and-first-pin`)

- [x] 1.1 Tests first (`tests/whos-in-and-first-pin.test.js`): who's in (today's check-ins, ended ones too, first check-in's time, the role; a mechanic due and one off; another shop's not seen; no PIN in the reply); Tills (the Owner only; open, float checked, short and seen); the ask (first, Skip, cleared, a PIN kept, the Owner never). Watch each fail
- [x] 1.2 Tests first (`tests/screens/whos-in-and-first-pin.test.js`, `tests/browser/whos-in-and-first-pin.spec.ts`): the Who's in card with In, Not in yet and Late; Tills for the Owner and not for Staff; the pop-up by itself, both wordings, Skip and Keep leaving the page, Escape doing nothing. Watch each fail
- [x] 1.3 Migration 098, the routes, the screens
- [x] 1.4 Route list and the owner-only allow-list
- [x] 1.5 Break each key rule on purpose, see its test go red, and restore
- [x] 1.6 Log choices in Jack's section of `decided-while-building.md`; lint, typecheck, `npm test`, `npm run test:browser`; self-review (sign-in, migration)
- [x] 1.7 `/opsx:archive` as the last commit, before merging
