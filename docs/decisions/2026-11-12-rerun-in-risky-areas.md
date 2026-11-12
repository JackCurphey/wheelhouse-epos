# Risky areas no longer force a second full run when files don't overlap (Jack, 12 Nov 2026)

Changes point 1 of `2026-11-11-rerun-only-when-main-overlaps.md`: its
condition "neither side touches a risky area" is replaced. Its other points
stand.

**The question.** On the night of 11 to 12 Nov, pull requests in a risky area
passed a full run, found main had moved, and had to queue for another full run,
several times over (#696 passed three full runs before it merged; Returning
customers, #699, needed seven). A full run takes about 15 minutes once its turn
comes, and the wait for the shared lock was often an hour or more.

**Jack's answer:** option 2, given to the Front desk session on 12 Nov
("b all yes").

1. A pull request that passed a full run on commit X doesn't re-run everything
   after main is merged in as Y, even when either side touches a risky area,
   provided:
   - its own changes since X are none, or only the archive commit or documents;
   - main's incoming files (`git diff --name-only X Y`) don't overlap its files;
   - main brought in **no migration** and no test infrastructure
     (`package.json`, the lockfile, `tests/helpers/`, `playwright.config.ts`,
     the test runner scripts).
2. Then lint and the related test files run on Y, and it merges when they pass.
3. Unchanged: risky-area pull requests still need `/review`, the
   risky-area reviewer, and a hand-run CI that is green before merging.
   A pull request with a migration still runs
   `node scripts/ci/check-migrations.mjs pr origin/main` before merging.

**Chosen over:** keeping the 11 Nov rule (safest, but hours of re-runs a night
while several sessions merge), and allowing one catch-up merge without a
re-run (halves the chasing, but adds a rule to remember).

**What it costs:** two risky changes that clash without sharing files can both
merge; the nightly CI run and the 7:30 test check catch it the next morning,
and a failed nightly run is fixed first thing.
