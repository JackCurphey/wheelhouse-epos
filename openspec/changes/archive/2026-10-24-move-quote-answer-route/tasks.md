# Tasks: the booking link's quote answer moves to server/routes/portal.js

## 1. The move

- [x] 1.1 Change the test first (`tests/portal-routes-file.test.js`): the quote answer is in `portal.js`, and `server.js` registers no route at all. Watched 3 tests fail because the route was still in `server.js`
- [x] 1.2 Move the route verbatim into `register()`; drop the unused imports (`route-files-defined` caught `readJsonBody`)
- [x] 1.3 `portal-routes-file`, `route-list` (snapshot regenerated: same 214 routes, new order), `route-files-defined` and the quote-answer tests pass
- [x] 1.4 `/review`; `npm test` and `npm run test:browser`; archive as the last commit
