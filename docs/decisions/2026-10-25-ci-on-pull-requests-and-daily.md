# When the tests run

Until 25 Oct, the tests (GitHub's "Tests" run) ran on every pull request and
again on `main` after every merge. The hosted copy waited for the second run,
about 20 minutes, before updating. While the repository is public, GitHub
runs all of this free (23 Oct, `repo-stays-public`), so the cost was the wait.

## Answer

**3. On each pull request, plus once a day; not after each merge.** Jack,
25 Oct: "actually 3", from these options:
1. Keep both.
2. Pull requests only, with the copy updating straight after each merge.
3. Pull requests, plus a daily full run, with the copy updating straight
   after each merge.
4. Only a daily run.

What it means:
- **On each pull request:** the tests still run, and a pull request still
  merges only once they pass on its final commit (the working agreement's
  rule is unchanged). GitHub makes a pull request include the latest `main`
  before it can merge, so what lands on `main` has just been tested.
- **Once a day, at 03:00 UTC (04:00 in summer, 03:00 in winter, UK time):**
  the tests run on `main`, as a safety net. They can also be run by hand.
- **After each merge:** the hosted copy updates straight away, without a
  second test run (`.github/workflows/deploy-hosted-copy.yml`). This changes
  `add-hosted-copy` design decision 3, which was Mark's. He is told in the
  pull request.
- **If the daily run fails:** GitHub emails whoever last changed the
  schedule, and the run shows red in the Actions tab. A problem that slipped
  through can therefore be found up to a day late.
