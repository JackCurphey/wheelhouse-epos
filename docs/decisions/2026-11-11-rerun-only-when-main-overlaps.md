# Re-run everything only when main's changes overlap (Jack, 11 Nov 2026)

Changes point 3 of `2026-10-28-ci-once-a-day.md` (merging relies on local
runs on the pull request's final commit, after merging the latest main).
Its other points stand.

**The question.** A pull request that had passed lint, `npm test` and
`npm run test:browser` had to run them all again whenever main moved before
it merged. With several sessions building at once, main moves often (17
pull requests merged on 11 Nov), and each full run takes about nine minutes
of the shared Mac once its turn in the queue comes (`npm run full-check`).
A pull request could chase main all afternoon.

**Jack's answer:** option 1, passed on by the Front desk session on 11 Nov.

1. **A pull request that passed doesn't re-run everything just because main
   moved**, when all of these hold:
   - it passed lint, `npm test` and `npm run test:browser` cleanly on a
     commit X;
   - main moved, and was merged in as a commit Y;
   - the pull request's own changes since X are none, or only the archive
     commit or documents;
   - main's incoming files (`git diff --name-only X Y`) don't overlap the
     pull request's files;
   - neither side touches a risky area (migrations; money and stock;
     sign-in, customer accounts and the portal; `server/server.js`,
     `server/db.js` or messaging);
   - main brought in no test infrastructure (`package.json`, the lockfile,
     `tests/helpers/`, `playwright.config.ts`, the test runner scripts).
2. **Then lint and the related test files run on Y**, and the pull request
   merges when they pass.
3. **Otherwise the full run happens as before**, on Y.

**Chosen over:** re-running everything after every merge of main (safest,
but pull requests queue behind each other on the one Mac).

**What it costs:** two pull requests that each passed alone can still clash
once both are in, when the clash isn't in files they share. The nightly CI
run and the 7:30 test check run everything on main, and catch it the next
morning; a failed nightly run is fixed first thing, as before.

**In CLAUDE.md:** rule 4 of "Allowed without asking" points here (Jack said
"Yes, make them" on 11 Nov).
