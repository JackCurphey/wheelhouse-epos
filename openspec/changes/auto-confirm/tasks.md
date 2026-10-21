# Tasks: confirming online bookings automatically

## 1. Server — Mark

- [x] 1.1 Tests first, watched failing: the setting starts off, saves and is Owner only; services carry `confirmsAutomatically`; with it on, a booking is saved accepted with `online_unseen`, and its link reads confirmed; with it off, unchanged; a booking that doesn't fit is still refused; jobs carry `newOnline`; `/seen` clears it
- [x] 1.2 The next free migration; `workshop-settings.js`; `portal.js` (services, bookings); `workshop.js` (`newOnline`, `/seen`)
- [ ] 1.3 A fresh review; `npm test` passes; merged

## 2. Screens — Jack, once 1.3 is merged

- [ ] 2.1 Tests first, watched failing: the Settings switch shows and saves at once, a refusal shows; step 4's button and line follow the setting; a `newOnline` block shows its mark (short in a narrow week column); opening the job posts `/seen`
- [ ] 2.2 The switch; step 4's wording; the diary mark; the job page's `/seen`
- [ ] 2.3 Browser: with the switch on, a customer's booking is confirmed at once and shows marked in the diary, and the mark goes once opened

## 3. Checks

- [ ] 3.1 A fresh review; `npm test` and `npm run test:browser` pass; archived once both halves are in
