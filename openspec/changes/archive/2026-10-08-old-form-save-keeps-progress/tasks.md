## 1. Test first

- [x] 1.1 Add "an old-form save that leaves the status as it was keeps work in progress" to `tests/workshop-legacy-save-version.test.js`; watched it fail (work read back "not_started", expected "in_progress")
- [x] 1.2 Add "an old-form save that changes the status still changes the job", which guards the deliberate change

## 2. Fix

- [x] 2.1 In `PUT /api/workshop-jobs/:id`, set the states from the old status only when it differs from the job's current old status; removing the comparison brings the failure back

## 3. Check and merge

- [x] 3.1 `npm test` and `npm run test:browser` pass locally
- [ ] 3.2 Fresh review; Mark's approval (server change); merge when CI is green on the final commit
- [x] 3.3 Archived into `openspec/specs/workshop-jobs/spec.md`
