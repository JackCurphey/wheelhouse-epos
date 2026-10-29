# Tasks

## 1. Server and screen (one pull request, `jack/working-pills`)

- [ ] 1.1 Tests first: `GET /api/till-checkin`'s `trustPin`; a tap while someone is working takes over and ends their check-in; a refused tap leaves them working (`tests/trust-pin.test.js`). Watch each fail
- [ ] 1.2 `trustPin` in the check-in
- [ ] 1.3 Tests first: the strip with trust PIN on in place of the bar, the person working highlighted, the Owner working added, a pill swapping on the same page, "Someone else" to the pad, a refusal shown, trust PIN off unchanged (`tests/screens/working-pills.test.js`); a browser spec. Watch each fail
- [ ] 1.4 Build the strip to `workshop-working-pills`
- [ ] 1.5 Break each key rule on purpose, see its test go red, and restore
- [ ] 1.6 Log choices in Jack’s section of `decided-while-building.md`; lint, `npm test`, `npm run test:browser`; self-review against the drawing and this spec
- [ ] 1.7 `/opsx:archive` as the last commit
