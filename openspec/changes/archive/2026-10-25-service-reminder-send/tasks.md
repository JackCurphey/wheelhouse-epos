# Tasks

- [x] 1.1 Tests first (`tests/service-reminder-send.test.js`): set up on collect for a yes, at the soonest months and the shop's opening time on the next open day; nothing without a yes or months; the newest collection of a bike wins; reopening the collection drops it; when due, each check stops it; the words written when it goes. Watch each fail
- [x] 1.2 The template, the module and the engine's two hooks
- [x] 1.3 Self-review and `/review` (messaging core, migration none); `npm test`, `npm run test:browser`, lint; archive as the last commit. The review's fixes: it reads the job's customer when it goes; a test for the bike collected again since; the wording box's subtitle as drawn. Left: a new online booking as a guest has no bike to match until check-in. `npm test`: 3222 passed, with only the 4 that need `ADMIN_DATABASE_URL` failing; `npm run test:browser`: 121 passed; each new test watched failing, and each part broken on purpose and seen red
