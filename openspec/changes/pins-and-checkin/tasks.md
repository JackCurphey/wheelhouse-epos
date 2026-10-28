# Tasks

## 1. Server (pull request 1, `jack/pins-and-checkin`)

- [x] 1.1 Tests first: migration 097 from an empty scratch database and run twice (`tests/migration-097.test.js`); the routes (`tests/pins-and-checkin.test.js`: a PIN offered, different each time, kept only as offered, unique, stored hashed; the Owner gets a team member; the Owner clears someone else's, not their own; check in by PIN, a wrong PIN, Switch, someone else taking over, a check-in from another sign-in or another shop not counting; guessing slowed; the float check needs a check-in and names its person). Watch each fail
- [x] 1.2 Migration 097, `server/routes/till-pins.js`, the float check's changes
- [x] 1.3 The route list snapshot, the owner-only list
- [x] 1.4 Break each key rule on purpose, see its test go red, and restore
- [ ] 1.5 Lint, typecheck, the touched tests; `/review` (sign-in, migration, money)

## 2. Screens (pull request 2, `jack/pins-and-checkin-screens`, stacked on 1)

- [ ] 2.1 Tests first: the PIN screen (dots, the 4th digit checks at once, a wrong PIN, Checked in today, No PIN yet), Serving and switch, the pay box's serving name, the float check after the check-in, Your settings' Till PIN and the pop-up (`tests/screens/`); a browser spec; the till's existing tests check in first. Watch each fail
- [ ] 2.2 Build them to the drawings
- [ ] 2.3 Break each key rule on purpose, see its test go red, and restore
- [ ] 2.4 Log choices in Jack's section of `decided-while-building.md`; lint, typecheck, `npm test`, the browser specs; `/review`
- [ ] 2.5 `/opsx:archive` as the last commit

## 3. Later pieces of WP-1.7 (each its own change when taken)

- [ ] 3.1 Clearing a PIN on screen: "Clear a forgotten PIN" and "Clear Jo Taylor's till PIN?" (`set-staff-person`, `set-staff-clear-pin`), with Staff and roles (WP-1.1)
- [ ] 3.2 A first sign-in opens "Your till PIN" by itself, and the cleared wording (`pin-first`, `pin-cleared`)
- [ ] 3.3 Giving a PIN at the till, screen turned to the person (`till-give-pin`), and a one-time PIN given by phone (signing in, later change 3 Oct)
- [ ] 3.4 Set up this till and the shop switcher (`till-setup`, `auth-site`); check-ins per till; the till bar's till name
- [ ] 3.5 The start-up status line and checking PINs offline (`till-checkin-offline`, `till-checkin-stale`), with step C
- [ ] 3.6 The shared workshop computer: Enter your PIN with no till number, back to it after 10 minutes idle; trust PIN with "Who's working?" and the Working pills, and the till's Serving pills (`till-checkin-workshop`, `till-checkin-workshop-names`, `workshop-working-pills`, `till-serving-pills`; roles 3, 9, 10); the two lines on `set-till-quick`
- [ ] 3.7 The practice band on the PIN screen (`till-checkin-practice`), with running alongside
- [ ] 3.8 Sales recorded under the checked-in person on the server, instead of the name the till sends
