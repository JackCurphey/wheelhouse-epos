# Tasks

- [x] 1.1 Tests first (`tests/customer/draft.test.js`, `tests/customer/book-resume.test.js`): kept for later; brought back with `resumed` in a new tab; no `resumed` on a same-tab refresh; over 7 days thrown away; clear removes both; the banner on the step left; Carry on; Start again. Watch each fail. They failed first, apart from the same-tab refresh and clear, which held until the kept copy existed and then went red when broken. Mutations caught: no age limit, no same-tab check, nothing kept, no jump to the step, Carry on doing nothing
- [x] 1.2 Build it to `bk-resume`
- [x] 1.3 Self-review; a browser test across a closed tab; `npm test`, `npm run test:browser`, lint; archive as the last commit. A browser test closes the tab and opens the booking page again: back on the bike step with it typed, the banner, Carry on, no banner after a refresh. `npm test`: 3125 passed, with only the 4 that need `ADMIN_DATABASE_URL` failing; `npm run test:browser`: 116 passed
