# Tasks: a queue for full test runs

## 1. The queue

- [x] 1.1 Tests first (`tests/full-check.test.js`), with fake step commands and a lock in a temporary folder: the lock is exclusive (a second run waits, saying who holds it, and runs after); a stale lock is taken over; a hand-made lock with the plain `owner` file sessions already write ("<pid> <worktree> <branch> <date>") is waited for while its process lives (this test was added after finding sessions queueing by hand on the same folder, and failed first: the script called such a lock stale and took it); the lock is let go after a failing command and after SIGINT and SIGTERM; all three steps run when the middle one fails, with a summary line each and a non-zero exit; the default steps are lint, test and test:browser in that order. Verify: all ten failed against an empty script (missing steps, missing npm script, runs that never started); each was then checked against a deliberate break (mkdir made non-exclusive, stale pids seen as alive, no release on exit, no signal handling, stopping after a failed step), and each break turned its test red.
- [x] 1.2 `scripts/full-check.mjs` and the `full-check` script in `package.json`. Verify: 1.1 passes (11 tests).
- [x] 1.3 The CLAUDE.md paragraph.

## 2. Its own merge

- [ ] 2.1 Self-review; `npm run full-check` on the final commit after merging the latest main; merge if clean.
