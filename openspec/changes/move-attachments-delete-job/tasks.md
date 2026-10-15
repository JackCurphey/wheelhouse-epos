# Tasks: deleting a job and its attachments move to server/routes/workshop.js

## 1. The move

- [x] 1.1 Extend `tests/workshop-routes-file.test.js` first: the five routes are registered in `workshop.js`, none in `server.js`, and `server.js` keeps no copy of the three helpers. Watched failing (3 tests)
- [x] 1.2 Move the code verbatim: all 109 removed non-blank lines appear in `workshop.js`; the one edit is `catch (err)` → `catch`, which the route files' unused-name check asks for
- [x] 1.3 `route-files-defined` (which also caught three imports `server.js` no longer uses, now removed), `route-list`, `workshop-routes-file` and the screen-trace check pass
- [x] 1.4 `npm test` (1787/1787) and `npm run test:browser` (34/34) pass locally
- [ ] 1.5 A fresh review confirms the move is pure
