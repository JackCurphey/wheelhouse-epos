# Tasks

- [x] 1.1 Tests first: the route (a yes from collection; a no; the view's remindersYes; an expired or made-up link refused) and the page (the tick in the in-shop card while ready, unticked, drawn words; ticking posts; said yes shows the line and Change; unticking says no; none on the paid card). Watch each fail
- [x] 1.2 The route and the view field
- [x] 1.3 The tick on the card, to the drawing
- [x] 1.4 Self-review and `/review` (`/api/portal/*`); `npm test`, `npm run test:browser`, lint; archive as the last commit. The review's fix: a test that a tick that doesn't save goes back and says so. Left: the route takes an answer at any stage the link works (an honest yes, counting from the next visit). `npm test`: 3229 passed, with only the 4 that need `ADMIN_DATABASE_URL` failing; `npm run test:browser`: 122 passed; each new test watched failing, and each part broken on purpose and seen red
