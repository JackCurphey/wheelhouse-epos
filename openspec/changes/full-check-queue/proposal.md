WP: none

# Proposal: a queue for full test runs on the shared Mac

## Why

Several sessions build on one Mac. Two full runs at once (`npm test` and the
browser tests) overload it and the shared Postgres: tests that pass alone fail
under the load, and on 10 and 11 Nov the Front desk session handed out turns by
hand. Jack chose on 11 Nov to have a queue do it instead.

## What Changes

- `npm run full-check` (`scripts/full-check.mjs`) takes a Mac-wide lock, an
  atomic `mkdir /tmp/wheelhouse-full-run.lock` shared by every worktree, with
  an owner file inside (pid, worktree, branch, commit, start time).
- While the lock is taken it says who holds it and since when, and checks again
  every 30 seconds. A lock whose process has gone is stale and is taken over.
- Holding it, it runs `npm run lint`, `npm test` and `npm run test:browser` in
  that order, all three even when one fails, then prints one summary line per
  step and exits non-zero if any failed.
- The lock is let go on exit, on Ctrl-C (or another stop signal) and on errors.
- `npm run full-check -- --lock-only -- <command>` takes the lock for any other
  command, such as a stress run, so those queue too.
- A paragraph in CLAUDE.md's "Testing and environment" says full runs go
  through `npm run full-check` (a project rules file).
- No behaviour a shop would see changes (`skip_specs`).

## Lane, drawings and decisions

- **Drawings:** none. **Follows:** Jack's choice of 11 Nov, passed on by the
  Front desk session; `docs/decisions/2026-10-28-ci-once-a-day.md` (merging on
  local full runs, which this queues).

## Out of scope

- Making the full run faster (Mark, #669 change 3).
- `npm run build` and `npm run migrate` before `npm test` stay as CLAUDE.md
  says; the queue runs only the three steps asked for.

## Impact

- `scripts/full-check.mjs` (new), `tests/full-check.test.js` (new),
  `package.json` (the `full-check` script), `CLAUDE.md`.
