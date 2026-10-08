# Tasks

This change writes down behaviour that is already built. There is no code
to write, so there are no new tests to watch fail; the work is checking the
spec against the code and tests, line by line. If a check finds the spec
wrong, the spec is corrected, never the code.

## 1. Check each requirement against its evidence

- [x] 1.1 For the job record requirements (reference number, creating, links, day-and-time rules, the order, reading and listing, editing, frozen finished work, deleting), open every test and code location in the `design.md` Evidence table and confirm each scenario and each quoted message matches; verified when every row is ticked in the review notes
- [x] 1.2 For the state requirements (three separate facts, booking moves, change-request refusal, staff cancellation, bike moves, work moves, refused-move message, version check, old-app save version, other shops, paying for the order), confirm the same way; verified when every row is ticked
- [x] 1.3 For days, attachments, the private link and the old five-value status, confirm the same way; verified when every row is ticked
- [x] 1.4 For the five job page requirements, confirm against the screen tests and `src/screens/diary/job-dialog.tsx`; verified when every row is ticked
- [x] 1.5 Run the evidence tests and see them pass on this branch: `npm test` with compose Postgres up (the server tests need it); verified by the test output showing no failures. Done in CI, which runs `npm test` against Postgres: the `test` check passed on this branch at b9a6927 (https://github.com/JackCurphey/wheelhouse-epos/actions/runs/37739003724)
- [x] 1.6 Confirm every quoted refusal message appears exactly in the code: search `server/server.js` and `server/workshop/` for each quoted string; verified when every quote is found word for word

## 2. Fresh review

- [x] 2.1 A reviewer who did not write the spec (a fresh subagent) checks `specs/workshop-jobs/spec.md` against the code, the tests and the drawings (job-overview, job-book-in, job-mechanic, job-waiting-parts, job-finished, job-collection), looking for anything described that the app does not do; verified by the reviewer's written findings, each one fixed in the spec or answered
- [ ] 2.2 Jack reads the "Differences from decisions and the older specs" list in `design.md` and says, for each, whether it stays as is or becomes a later change; verified by his answer recorded in the pull request. Still waiting for Jack's answer. Differences 1 and 3 already have their own changes (#188 and #189)

## 3. Point the old documents at the new spec

- [x] 3.1 Add one line at the top of `docs/superpowers/specs/2026-10-03-staff-job-page-design.md` and of `docs/superpowers/specs/2026-10-03-multi-day-jobs-design.md` saying they are history and pointing to `openspec/specs/workshop-jobs/spec.md`; verified by reading the top of each file

## 4. Validate and merge

- [x] 4.1 Run `openspec validate document-workshop-jobs --strict`; verified when it prints that the change is valid
- [ ] 4.2 Open a pull request from `jack/openspec-workshop-jobs` (documentation only; about 1,400 lines, above the 250–600 aim, so say so in the pull request or split the job page requirements into a second change) and merge once CI has passed on its final commit; verified by the green CI run on that commit. Pull request open (#187). Merging comes after this archive, which is the pull request's last commit (#186), so this box stays open here

## Workflow follow-up

- Check the archived spec has the Purpose section and all requirements, with `openspec show workshop-jobs --type spec`.
