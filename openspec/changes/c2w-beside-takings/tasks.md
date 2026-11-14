## 1. Cycle to Work beside the takings

- [x] 1.1 Test first: the close's takings leave out the Cycle to Work figure, at the close and when a reopened day is closed again (`tests/close-the-day.test.js`). Watched failing on the old code (takings £1,005.00, with the £880.00 share inside).
- [x] 1.2 `takingsIn` (`server/routes/close-the-day.js`): takings is card + cash + other.
- [x] 1.3 Record Jack's answer in `docs/decisions/decided-while-building/2026-11-jack.md` and in `openspec/changes/cycle-to-work/tasks.md`, and log the default for days already closed.
- [ ] 1.4 `/review`, the `risky-area-reviewer` agent, lint, `npm test`, `npm run test:browser`, CI run by hand on the branch, then archive as the last commit.
