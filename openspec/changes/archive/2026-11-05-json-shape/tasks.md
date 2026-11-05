# Tasks

- [x] 1.1 Prove the crash on the real server in `node:22-alpine` at 1 GB; measure `JSON.parse` by shape, size and how many are kept at once (`design.md`)
- [x] 1.2 Tests first (`tests/json-shape.test.js`), on servers with the same 524 MB heap, so a break crashes on any machine: the crash; each door's limit, just over and just under; each character; a count across pieces; the smaller limit on small routes with no sign-in; an honest booking at the largest allowed. Watch each fail for the right reason
- [x] 1.3 `server/lib/read-body-first.js`: count the characters that make values as a body arrives; gates say the limit and the small route's size. `server/lib/http.js`: a body handed to its route isn't held twice
- [x] 1.4 Scenarios at the limits, many at once, on the real server in the container
- [x] 1.5 Break each changed branch on purpose, confirm the break is in the file, see the tests go red, restore and check the restore
- [x] 1.6 Self-review; Node 22 as well as the machine's; `npm test`, `npm run test:browser`, the drawing coverage check and lint on the head after merging main
