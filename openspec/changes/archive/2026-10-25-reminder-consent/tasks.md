# Tasks

- [x] 1.1 Tests first: the server (a ticked booking saves the yes with when and how; unticked writes nothing and keeps an earlier yes; a refused booking writes nothing) and the screen (the tick, unticked, drawn words; ticking sends `remindMe: true`; unticked sends none; kept in the draft). Watch each fail
- [x] 1.2 Migration 077 and the booking route
- [x] 1.3 The tick on the details step, to the drawing
- [x] 1.4 Self-review and `/review` (migration; `/api/portal/*`); `npm test`, `npm run test:browser`, lint; archive as the last commit. The review's fixes: a check that every yes says when and where; a refused booking after the slot check records nothing; the tick at the drawn 22px. Left for Jack: whether a merge carries a yes over. `npm test`: 3197 passed, with only the 4 that need `ADMIN_DATABASE_URL` failing; `npm run test:browser`: 120 passed; each new test watched failing, and each part broken on purpose and seen red
