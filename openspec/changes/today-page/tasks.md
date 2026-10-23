# Tasks

## 1. Needs attention, the server

- [x] 1.1 Write tests first (`tests/needs-attention.test.js`, live server): a sent and reminded quote with no answer is listed with the job, customer, phone and times; a quote sent but not reminded, answered, withdrawn or not the job's current one is not; two conversations needing a reply give one line with the count and the oldest; nothing waiting gives an empty list; a member of staff who isn't the Owner is refused; another shop's jobs never appear. Watch each fail
- [x] 1.2 Build `GET /api/needs-attention` (`server/routes/today.js`, registered; route list and screen-trace comment). Verify 1.1 passes

## 2. The page

- [x] 2.1 Move the Overview's day rules and Book in into a shared module; the Overview's tests pass unchanged
- [ ] 2.2 Write screen tests first (`tests/screens/today.test.js`): the date and shop; Workshop today's figures, Still to arrive list, Book in when due, Open the diary; Needs attention with its count, the no-answer line (phone link; Record their answer opens the job) and the messages line (Open Messages), "Nothing needs you right now"; Staff see Workshop today only; phone width shows one column. Watch each fail
- [ ] 2.3 Build `src/screens/today/` to `op-today`, registered for `/workshop/today`. Verify 2.2 passes, and the staff-shell test "the owner lands on Today" still passes
- [ ] 2.4 A browser test of Today at phone and computer widths
- [ ] 2.5 Log what's decided while building; update the build board's Today page from "old" when the status update runs

## 3. Checks

- [ ] 3.1 `npm run lint`, `npm test` and `npm run test:browser` pass, then a fresh review

## Workflow follow-up

- Archive the change with `/opsx:archive` as the last commit of the pull request, before it merges.
