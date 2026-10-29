# Tasks

## 1. Server and screens (one pull request, `jack/workshop-computer`, on `jack/till-setup-screens`)

- [x] 1.1 Tests first: migration 101 from an empty scratch database and run twice (`tests/migration-101.test.js`); the routes (`tests/workshop-computer.test.js`: the Owner only; the cookie holds the workshop computer, the server only its hash; already a till or a workshop computer; a check-in counts only on its workshop computer; idle 10 minutes ends it on the server, used keeps it, a till never; Checked in today is the computer's; no giving a PIN there). Watch each fail
- [x] 1.2 Migration 101, `server/till/this-workshop.js`, the routes
- [x] 1.3 The route list snapshot, the owner-only list
- [x] 1.4 Tests first: Set up this computer's choice, the workshop PIN screen and its bar, the PIN opening the diary, Working and Switch, idle back to the PIN screen, used keeps it (`tests/screens/workshop-computer.test.js`); a browser spec. Watch each fail
- [x] 1.5 Build the screens to the drawings
- [x] 1.6 Break each key rule on purpose, see its test go red, and restore
- [x] 1.7 Log choices in Jack’s section of `decided-while-building.md` (done, 28 Oct); lint, typecheck, `npm test`, `npm run test:browser` (done, 28 Oct); `/review` (sign-in, migration): 28-29 Oct, two rounds; the PIN hole and all findings fixed
- [x] 1.7a Review, 29 Oct, and Jack's answer 1 (`docs/decisions/2026-10-29-answers.md`): the sign-in's own PIN and settings only for its own team member on a workshop computer; Today's Tills leave workshop computers out; the cookie's limit written down; the screen's 10 minutes from its last telling; no pages if the check-in can't be read; one status region and a full-size Switch; migration 101's never-both check. Tests first, each fix broken on purpose
- [x] 1.7b Second review, 29 Oct: Your settings says plainly that settings change only on your own sign-in, switches unavailable; no float check on a workshop computer with nobody working; /me's workshopComputer false when the browser is also a till. Tests first, each fix broken on purpose
- [x] 1.8 `/opsx:archive` as the last commit

## 2. Later pieces of task 3.6 (each its own change when taken)

- Later, not in this change: 2.1 Trust PIN and how long before a workshop computer goes back, Owner only, in a "Signing in" fold on Till settings (the two lines on `set-till-quick`; stage-1 gaps 9; roles and switches 3 and 9: off to start; 5, 10, 15 or 30 minutes, or off, only with trust PIN on)
- Later, not in this change: 2.2 "Who's working?" after the computer is left alone with trust PIN on (`till-checkin-workshop-names`), with the server accepting a tap only for someone who typed their PIN on that computer today
- Later, not in this change: 2.3 The Working pills at the bottom of every workshop page with trust PIN on, in place of the Working bar (`workshop-working-pills`; roles and switches 9)
- Later, not in this change: 2.4 The till's Serving pills with trust PIN on, the sale moving to the new name (`till-serving-pills`; roles and switches 10), and tapping a name in Checked in today (stage-1 gaps 11)
- Later, not in this change: 2.5 Owner and Manager pages asking for a PIN every time on a workshop computer (stage-1 gaps 1; walk-through 8 decision 3), with roles (WP-1.1)
- Later, not in this change: 2.6 The diary's "Me" as the person working, and Your settings as theirs with no Change PIN (walk-through 8 M2, M3); work recorded under the person working (task 3.8), and then the drawn line "What you do on this computer is recorded under your name and role."
- Later, not in this change: 2.7 Renaming or switching off a workshop computer, with the Tills list (WP-5.1)
- Later, not in this change: 2.8 Work done on a workshop computer recorded under the person working, not the sign-in's login: stock changes, stock takes, customer messages, receipt emails, no-shows and the rest (task 3.8)
