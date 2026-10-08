## 1. Test first

- [x] 1.1 Add "tendering the order for work already finished goes through and leaves the job as it is" to `tests/workshop-work-actions.test.js`; watched it fail with 409 "cannot finish a job that is complete; from here you can reopen"

## 2. Fix

- [x] 2.1 In `POST /api/sale-documents/:id/convert`, treat work already finished as nothing to finish; the new test and the existing payment tests pass

## 3. Mark's review (8 Oct)

- [x] 3.1 Add "paying real money for work already finished goes through and leaves the job as it is" (a real cash payment, not £0)
- [x] 3.2 Add "work reopened while the payment for finished work goes through: the sale stands and the reply warns"; watched it fail in CI with "the work was reopened before the sale was made, so the reply must warn; got undefined"
- [x] 3.3 After the sale, check already-finished work again and warn if it was reopened, the way the in-progress path warns

## 4. Check and merge

- [x] 4.1 `npm test` and `npm run test:browser` pass locally (first round; for Mark's review round the server tests ran in CI, as the worktree had no `.env`)
- [x] 4.2 Break the fix on purpose and see the new test fail, then restore
- [x] 4.3 `openspec archive allow-paying-for-finished-work` so `openspec/specs/workshop-jobs/spec.md` carries the new scenario; archiving is the last commit before merge
- [ ] 4.4 Fresh review; Mark's approval (server change); merge when CI is green on the final commit
