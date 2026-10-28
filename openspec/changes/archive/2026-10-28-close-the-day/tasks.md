# Tasks

## 1. Server (pull request 1, `jack/close-the-day`)

- [x] 1.1 Tests first: migration 096 from an empty scratch database and run twice (`tests/migration-096.test.js`); the routes (`tests/close-the-day.test.js`: the day's cash from both records, the expected figure from this morning's float, paid-outs in whole pence with a reason, one close a day and two at once keep one, no paid-out after the close, banking with the float left, a count below the float banks nothing, no close without a float or a float check, Owner only, the button's time, each shop sees only its own; an over float on Today only when the previous day was closed, and Seen). Watch each fail
- [x] 1.2 Migration 096, `server/routes/close-the-day.js`, the over float in `float-check.js` and `today.js`
- [x] 1.3 The route list snapshot, the owner-only list
- [x] 1.4 Break each key rule on purpose, see its test go red, and restore
- [x] 1.5 Lint, typecheck, the touched tests; `/review` (migration, money) — /review 27 Oct: nothing blocking; fixes and Jack's answers 4 to 8 done

## 2. Screens (pull request 2, `jack/close-the-day-screens`, stacked on 1)

- [x] 2.1 Tests first: the Close the day page, the paid-out and report pop-ups, the till's button, Today's over float line (`tests/screens/`); a browser spec for `/workshop/till/close`. Watch each fail
- [x] 2.2 Build them to the drawings
- [x] 2.3 Break each key rule on purpose, see its test go red, and restore
- [x] 2.4 Log choices in Jack's section of `decided-while-building.md`; lint, typecheck, `npm test`, the browser specs; `/review` — /review 27 Oct: nothing blocking; fixes and Jack's answers 4 to 8 done
- [x] 2.5 `/opsx:archive` as the last commit
