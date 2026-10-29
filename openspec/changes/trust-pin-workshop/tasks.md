# Tasks

## 1. Trust PIN and the idle time (2.1; first pull request, `jack/trust-pin`)

- [x] 1.1 Tests first: migration 103 from an empty scratch database and run twice (`tests/migration-103.test.js`); the settings routes (Owner only, what they accept, 10 minutes to start, trust PIN off is always 10, a shorter time ends the check-in sooner, Off never ends it) in `tests/trust-pin.test.js`. Watch each fail
- [x] 1.2 Migration 103, `trustPinHere`, the routes; the route list snapshot and the owner-only list
- [x] 1.3 Tests first: the Signing in fold (off to start, the times only with it on, saved when chosen) and the screen going back at the shop's time (`tests/screens/trust-pin.test.js`). Watch each fail
- [x] 1.4 Build the fold and the screen's time
- [x] 1.5 Break each key rule of section 1 on purpose, see its test go red, and restore; lint, `npm test`, `npm run test:browser`
- [x] 1.6 Review, 29 Oct: the Owner's own check-in on a workshop computer waits 10 minutes at most, whatever the setting (design 8); `employees.pin_set_at` in migration 103 for section 2. Tests first, each watched failing, the fix broken on purpose

## 2. Who's working? (2.2; second pull request, `jack/trust-pin-names`, on the first)

- [x] 2.1 Tests first: the names (typed here today, not by a tap, not the Owner, not after a cleared PIN), the tap's refusals (not a workshop computer, trust PIN off, not typed here), a tap checks in. Watch each fail
- [x] 2.2 The names and the tap route
- [x] 2.3 Tests first: "Who's working?" after Switch and left alone, a tap making the person working, "Someone else — enter your PIN". Watch each fail. A browser spec, written after the screen and watched failing with the names hidden
- [x] 2.4 Build the screen to `till-checkin-workshop-names`

## 3. Finish

- [x] 3.1 Break each key rule on purpose, see its test go red, and restore
- [x] 3.2 Log choices in Jack’s section of `decided-while-building.md`; lint, `npm test`, `npm run test:browser`; self-review against the drawings and this spec
- [ ] 3.3 `/opsx:archive` as the last commit
