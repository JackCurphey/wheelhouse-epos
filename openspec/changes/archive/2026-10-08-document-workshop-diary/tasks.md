# Tasks

This change writes down behaviour that is already built. There is no code
to write, so there are no new tests to watch fail; the work is checking the
spec against the code and tests, line by line. If a check finds the spec
wrong, the spec is corrected, never the code.

## 1. Check each requirement against its evidence

- [x] 1.1 For the diary view requirements (week, Day view, people chips, colours and legend, ended bookings, No time row, grid hours, lanes and stacks, multi-day blocks, the change-request outline, the phone), open every test and code location in the `design.md` Evidence table and confirm each scenario matches; verified when every row is ticked in the review notes
- [x] 1.2 For moving and New job (moving, refused moves, dropping on the requested time, choosing a time, the form, the job menu and overview), confirm the same way, checking the quoted server message against `checkJobSlot` rather than the pretend server's words; verified when every row is ticked
- [x] 1.3 For "Waiting for you" and the answers (the list, the column, the booking-request pop-up, accept-change and decline-change, Seen, refusals said plainly, other ways a request ends, the old app's column and pop-up), confirm the same way; verified when every row is ticked
- [x] 1.4 For capacity (weekday hours, blocks, staff not held to capacity, free time, the capacity view, what customers are offered, customer refusals, holds, minimum notice, the shop's today), confirm the same way against `server/capacity.js`, `server/clock.js` and the tests; verified when every row is ticked
- [x] 1.5 For the settings requirements (reading and saving, mode and lengths, the scheduled mode change, notice and time zone, prices and terms) confirm the same way; verified when every row is ticked
- [x] 1.6 Confirm every quoted message appears word for word in the code: search `server/server.js`, `server/capacity.js`, `src/screens/diary/` and `public/diary-*.js` for each quoted string; verified when every quote is found
- [ ] 1.7 Run the evidence tests and see them pass on this branch: `npm run pretest`, then `npm test` with compose Postgres up, and `npm run test:browser` for the three diary browser files; verified by the test output showing no failures (the fresh review ran 25 of the evidence files, 260 tests passing; the rest were not run locally. The full suite runs in CI on this pull request, which is where the remaining evidence tests are checked)

## 2. Fresh review

- [x] 2.1 A reviewer who did not write the spec (a fresh subagent) checks `specs/workshop-diary/spec.md` against the code, the tests and the drawings (diary, diary-phone, request-new, request-decline, request-change, request-cancel, new-job, new-job-day, diary-hover-summary, diary-stack-hover, diary-stack-open, diary-context-menu), looking for anything described that the app does not do and anything that duplicates `workshop-jobs`; verified by the reviewer's written findings, each one fixed in the spec or answered
- [x] 2.2 Jack reads the "Surprising" list in `design.md` and says, for each, whether it stays as is or becomes a later change; verified by his answer recorded in the pull request
- [ ] 2.3 Mark is told the spec describes `server/capacity.js` and `server/clock.js` (his, shared) and has the chance to correct it; verified by his reply in the pull request

## 3. Point the old documents at the new spec

- [x] 3.1 Add one line at the top of `docs/superpowers/specs/2026-10-03-staff-diary-view-design.md` and `docs/superpowers/specs/2026-09-27-staff-diary-waiting-design.md` saying they are history and pointing to `openspec/specs/workshop-diary/spec.md`; verified by reading the top of each file
- [x] 3.2 Add one line at the top of `docs/superpowers/specs/2026-09-27-book-server-12-change-cancel-design.md`, `2026-09-26-book-server-10-notice-timezone-design.md` and `2026-09-24-book-server-2-modes-capacity-design.md` saying their staff side and capacity rules now live in `openspec/specs/workshop-diary/spec.md`, and their customer side stays current until `online-booking` is written; verified by reading the top of each file

## 4. Validate and merge

- [x] 4.1 Run `openspec validate document-workshop-diary --strict`; verified when it prints that the change is valid
- [ ] 4.2 Open a pull request from `jack/openspec-workshop-diary` (documentation only; well above the 250–600 line aim, so say so in the pull request or split it into diary views, waiting and answers, and capacity and settings) and merge once CI has passed on its final commit; verified by the green CI run on that commit

## Workflow follow-up

- Check the archived spec has the Purpose section and all requirements, with `openspec show workshop-diary --type spec`.
