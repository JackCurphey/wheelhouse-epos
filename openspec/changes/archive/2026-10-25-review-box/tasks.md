# Tasks

- [x] 1.1 Tests first (`tests/screens/settings-review-box.test.js`): the drawn box; the switch off without a page, with the drawn line; typing a page lets it on; Save sends the settings then the template; a refusal stays in the box; Cancel sends nothing. Watch each fail
- [x] 1.2 The box, to the drawing
- [x] 1.3 A browser test against the real server: switch on with a page, and the settings and message are saved
- [x] 1.4 Self-review; `npm test`, `npm run test:browser`, lint; archive as the last commit. Self-review: clearing the page while it's on saves it off first; the list's own switch shows the shop's words for a refusal. `npm test`: 3264 passed, with only the 4 that need `ADMIN_DATABASE_URL` failing; `npm run test:browser`: 124 passed; each new test watched failing, and each part broken on purpose and seen red
