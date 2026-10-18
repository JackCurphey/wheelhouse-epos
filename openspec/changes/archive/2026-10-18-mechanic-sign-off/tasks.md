# Tasks: the mechanic sign-off, piece 1

## 1. Server half (Jack's workshop area; Mark approves)

- [x] 1.1 Server tests first, watched failing: finish needs an active mechanic (missing, not a mechanic, another shop's); finish records who and when and a history row; reopen-work and the old app's PUT clear it and stamp the history row; every read carries the three fields
- [x] 1.2 Migration 040 (tested from an empty scratch database); finish, reopen-work, the old PUT and the job read

## 2. Screens half

- [x] 2.1 Screen tests first, watched failing: Mark ready opens the pop-up with the job's mechanic picked; a shared-queue job has nobody picked and the button waits; Sign off and mark ready sends finish with signedOffBy; Cancel finishes nothing; the finished page shows Signed off by
- [x] 2.2 `SignOffDialog`; the job page's Mark ready and Signed off line
- [x] 2.3 Browser: mark a job ready, sign off, and see the line, against the real server

## 3. Checks

- [x] 3.1 A fresh review; `npm test` and `npm run test:browser` pass
