# Tasks: input checks (audit items 19, 21, 22)

## 1. Server — Mark

- [x] 1.1 Tests first, watched failing: `tests/input-checks.test.js` (a mechanic of `"abc"` gave a 500 "invalid input syntax for type integer"; a mechanic deleted mid-finish gave a 500 "recordSignOff: employee … not found"; one switched off mid-finish still signed; `"false"` was saved for all three settings)
- [x] 1.2 `resolveJobMechanicId` takes a whole number only (one check in Jack's `server/workshop/jobs.js`)
- [x] 1.3 `recordSignOff` re-reads the mechanic, active, `FOR SHARE`, and returns false when they've gone; the finish route refuses with `sign_off_required` (Jack's `server/workshop/sign-off.js`, `server/routes/workshop.js`); the till warns (`server/routes/sales.js`)
- [x] 1.4 The four on/off settings (storage slots joined them on `main`; its screen sends a real boolean) take only true or false (`server/routes/workshop-settings.js`)
- [x] 1.5 Logged in Mark's section of `decided-while-building.md`
- [x] 1.6 A fresh review (no P1/P2; P3 fixed: an id too big for the database gave a 500, now refused); `npm test` passes

## 2. Checks

- [ ] 2.1 Jack approves the lines in his files
- [ ] 2.2 `npm test` and `npm run test:browser` pass; archived as the last commit of the pull request
