# Tasks: retire the old app's workshop diary

## 1. Tests first, each watched failing

- [x] 1.1 In a real browser: an old `#workshop` address and the old Workshop tab open `/workshop/diary` (both stayed on `/#workshop`); an order's "View / edit workshop job" opens the old form with the shop's mechanics (none were listed)

## 2. Remove

- [x] 2.1 The old diary, its pop-ups, styles and helper scripts out of the old app; the Workshop tab and `#workshop` open the new diary
- [x] 2.2 The old job form loads mechanics itself and no longer draws the old diary after a save or delete
- [x] 2.3 The tests that covered only the old diary removed; the design-scale test keeps only the badge

## 3. Checks

- [ ] 3.1 A fresh review; `npm test` and `npm run test:browser` pass
