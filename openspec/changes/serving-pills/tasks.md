# Tasks

## 1. Server and screens (one pull request, `jack/serving-pills`)

- [ ] 1.1 Tests first: on a till, `names` and the tap (typed on this till today; not another till, not a workshop computer, not the Owner, not with trust PIN off; a browser that is neither refused with `not_shared_computer`); the check-in recorded on the till (`tests/serving-pills.test.js`). Watch each fail
- [ ] 1.2 The tap and `names` on a till
- [ ] 1.3 Tests first: the pills under the quick buttons with trust PIN on, the person serving highlighted, a pill swapping with the sale kept and paid under the new name, "Someone else" to Enter your PIN, none with trust PIN off; Checked in today's names tappable with trust PIN on (`tests/screens/serving-pills.test.js`); a browser spec. Watch each fail
- [ ] 1.4 Build to `till-serving-pills`, sharing the workshop's pill strip
- [ ] 1.5 Break each key rule on purpose, see its test go red, and restore
- [ ] 1.6 Log choices in Jack’s section of `decided-while-building.md`; lint, `npm test`, `npm run test:browser`; self-review against the drawing and this spec
- [ ] 1.7 `/opsx:archive` as the last commit

## Waits for Mark (not in this change)

- Sales recorded under the person checked in, on the server (task 3.8, after step C)
- Tapping a name with the till offline (task 3.5, step C)
