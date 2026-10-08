## 1. Test first

- [x] 1.1 Add "tendering the order for work already finished goes through and leaves the job as it is" to `tests/workshop-work-actions.test.js`; watched it fail with 409 "cannot finish a job that is complete; from here you can reopen"

## 2. Fix

- [x] 2.1 In `POST /api/sale-documents/:id/convert`, treat work already finished as nothing to finish; the new test and the existing payment tests pass

## 3. Check and merge

- [x] 3.1 `npm test` and `npm run test:browser` pass locally
- [x] 3.2 Break the fix on purpose and see the new test fail, then restore
- [ ] 3.3 Fresh review; Mark's approval (server change); merge when CI is green on the final commit
- [x] 3.4 `openspec archive allow-paying-for-finished-work` so `openspec/specs/workshop-jobs/spec.md` carries the new scenario
