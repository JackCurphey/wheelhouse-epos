# Tasks

- [x] 1.1 Tests first: the settings (page and days, refused when wrong; on refused without a page; clearing the page refused while on); set up on collect (only when on, a page, a yes; at the days, when the shop opens; reopening drops it); when it goes (checks; the words and page written then; the kept stop line); the stop page for review requests (server and screen). Watch each fail
- [x] 1.2 Migration 080, the settings, the template, the module, the engine's hooks and the stop kind
- [x] 1.3 The stop page's words for review requests
- [x] 1.4 Self-review and `/review` (migration, `/api/portal/*`, messaging core); `npm test`, `npm run test:browser`, lint; archive as the last commit. The review's fixes: the preview has the review link and Stop these; on collect, a fault in one message doesn't stop the other; a test that one collection sets up both. `npm test`: 3258 passed, with only the 4 that need `ADMIN_DATABASE_URL` failing; `npm run test:browser`: 123 passed; each new test watched failing, and each part broken on purpose and seen red
