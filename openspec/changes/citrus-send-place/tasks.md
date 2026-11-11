# Tasks

## 1. The fix and its test

- [x] 1.1 `server/routes/move.js`: the place remembers which send holds it, and every answer gives it up just before it goes (design, Decision).
- [x] 1.2 Test (`tests/citrus-import.test.js`, "a shop's place is free again by the time its send is answered"). It was written after a self-review found the gap that 1.1 closes. Watched failing on main's `move.js`, and with each of the 400, 422 and ownership parts removed in turn.
- [ ] 1.3 Load test, old against new (`npm run full-check -- --lock-only`): three copies each of citrus-import and delete-account, twice, with eight processes keeping the CPUs busy. Results in the pull request.

## 2. Checks

- [ ] 2.1 Related tests: citrus-import, citrus-import-locks, delete-account, messaging-engine.
- [ ] 2.2 `/review` and the risky-area-reviewer agent; findings fixed or written up.
- [ ] 2.3 `npm run full-check` passes on the final commit after merging main.
- [ ] 2.4 CI run by hand on the branch (`gh workflow run test.yml --ref <branch>`) is green.
- [ ] 2.5 `openspec archive citrus-send-place` as the last commit.
