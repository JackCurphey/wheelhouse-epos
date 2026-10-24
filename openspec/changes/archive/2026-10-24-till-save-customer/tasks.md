# Tasks

- [x] 1.1 Tests first (`tests/screens/till-page.test.js`): the tick with no customer, unticked; no tick with a customer; ticked, then Add a customer filled in; Add posts the customer; Not now posts nothing; the countdown waits through it. Watch each fail. Four failed first; the two about what mustn't happen (unticked adds no one; no tick with a customer) passed until the tick existed, then went red when the tick was forced on or shown with a customer. Mutations caught: the tick ignored, offers on by default, Add not carrying on
- [x] 1.2 Build it to the drawing
- [x] 1.3 Self-review; `npm test`, `npm run test:browser`, lint; archive as the last commit. A browser test against the real server saved Maya with offers off; `npm test`: 3119 passed, with only the 4 that need `ADMIN_DATABASE_URL` failing; `npm run test:browser`: 117 passed
