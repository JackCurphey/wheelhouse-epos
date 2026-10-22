# Tasks: two specs say what the code does

Spec text only; no code, so no new tests. Each changed line is checked
against the code and the tests that already cover it.

## 1. Spec text — Mark

- [x] 1.1 Read the code and its tests: `queueBikeReady` (a minute), `sendBookingMessage` and the old app's one-off text (at once), the quote send route (at once, after the panel's minute); the job save route's status refusal and `tests/workshop-legacy-save-version.test.js`
- [x] 1.2 `messages` delta: the Undo requirement renamed and narrowed to Bike ready and the quote, quoting the decisions in the proposal
- [x] 1.3 `workshop-jobs` delta: the accept/decline requirement no longer says the old app's save can reopen an ended booking
- [x] 1.4 `openspec validate spec-drift --strict` passes
- [x] 1.5 A fresh review against the code and the decisions (no P1; both P2s fixed, except renaming the quote scenario "Undo", which archive refuses: a MODIFIED block must keep the current scenarios)

## 2. Checks

- [ ] 2.1 `npm test` and `npm run test:browser` pass (no code changed; `npm test` run 22 Oct: 2411 tests, 2409 pass, 0 fail, 2 skipped; `test:browser` not run yet)
- [ ] 2.2 Archived as the last commit of the pull request; the `messages` Purpose line edited by hand at the same time, to the words in `design.md`
