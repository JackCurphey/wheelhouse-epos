# Tasks

- [x] 1.1 Tests first (`tests/settings-saves-dont-clash.test.js`): two saves of different fields at once, 30 rounds, both stored every round, for workshop settings, label settings and website settings, and another shop's settings untouched. Watched each fail: a change lost in 30 of 30 rounds
- [x] 1.2 Workshop settings: the save in a transaction, reading the row `FOR UPDATE`; the body read first; the checks unchanged; 200 after `COMMIT`
- [x] 1.3 Label settings and `updateStorefrontSettings`: the same lock
- [x] 1.4 Break each fix on purpose (drop `FOR UPDATE`; drop the `BEGIN`), confirm the edit landed, see the test go red, restore
- [x] 1.5 A refused save writes nothing and the next save goes through; break a check on purpose and see it go red
- [ ] 1.6 Self-review; `npm test`, `npm run test:browser` and lint; archive as the last commit
