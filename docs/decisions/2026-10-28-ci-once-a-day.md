# CI once a day, and by hand on risky pull requests (Jack, 28 Oct 2026)

Replaces `2026-10-25-ci-on-pull-requests-and-daily.md` (option 3: on each
pull request and once a day).

**The question.** CI ran on every pull request, and GitHub required it to
pass before anything merged into main. Each run takes about 25 minutes and
they queue one at a time, so a day of pull requests waits on each other.

**Jack's answer:** "Daily, plus PRs on demand".

1. **CI runs once a day** on main at 03:00 UTC, and whenever it is started
   by hand. It no longer runs on each pull request.
2. **GitHub's "tests must pass before merging" rule on main is turned off**,
   so a pull request can merge without a CI run.
3. **Merging relies on the local runs:** `npm test` and `npm run test:browser`
   pass on the pull request's final commit, after merging the latest main.
4. **In a risky area** (migrations; money and stock; sign-in, customer
   accounts and public routes; `server.js` and the messaging core), CI is
   also run by hand on the branch (`gh workflow run test.yml --ref <branch>`)
   and the pull request merges when it is green.
5. **A failed nightly run is fixed first thing,** before new work.

**Chosen over:** CI once a day with nothing by hand (fastest, but risky
pull requests merge untested by CI), and keeping CI on every pull request
(slowest, main never breaks).

**What it costs:** two pull requests that each pass alone can break each
other once both are in. Main, and the test copy that updates on each merge,
can then stay broken until the nightly run or the next local run finds it.
Mark's pull requests also no longer get a check unless one is started.
