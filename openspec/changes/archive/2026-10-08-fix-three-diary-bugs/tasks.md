## 1. Tests first

- [x] 1.1 New job: "Waiting for parts" with the bike here saves once and closes (`tests/screens/diary-new-job.test.js`); watched it fail (the book-in was sent)
- [x] 1.2 Change request pop-up names the mechanic on each side (`tests/screens/diary-answer.test.js`); watched it fail; the existing from/to test's expected text updated to match
- [x] 1.3 Week-view drop on the requested time sends the mechanic asked for, and a drop elsewhere sends none (`tests/screens/diary-move.test.js`); watched it fail (no mechanic sent)

## 2. Fixes

- [x] 2.1 `new-job-dialog.tsx`: no book-in when the created job is already in the shop
- [x] 2.2 `request-dialog.tsx`: From and To name the mechanic; the sentence drops "and mechanic"
- [x] 2.3 `diary-page.tsx`: a Week-view or everyone drop on exactly the requested day and time sends the requested mechanic
- [x] 2.4 Breaking each fix makes its test fail; restored, all diary screen tests pass

## 3. Check and merge

- [x] 3.1 `npm test` and `npm run test:browser` pass locally
- [ ] 3.2 Fresh review; merge when CI is green on the final commit
- [x] 3.3 Archived into `openspec/specs/workshop-diary/spec.md`
