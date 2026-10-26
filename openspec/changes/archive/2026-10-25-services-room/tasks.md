# Tasks

- [x] 1.1 Tests first (`tests/screens/settings-services.test.js`): the fold first with its summary; the pills choosing a group; the rows (name, minutes, price, Edit, Remove), with removed services left out; Edit's box filled in and Save sending exactly the shown fields; a refusal in the box; "+ Add a service" empty in the chosen group, with online booking on; Remove sending the delete; the note. Watch each fail
- [x] 1.2 Build `services-settings.tsx` to the drawing, and put it first in Workshop
- [x] 1.3 A browser test against the real server: add, change and remove a service, and New job sees it
- [x] 1.4 Self-review; `npm test`, `npm run test:browser`, lint; archive as the last commit. All 7 screen tests failed first; five parts broken on purpose were each caught. `npm test`: 3195 passed, with only the 4 that need `ADMIN_DATABASE_URL` failing; `npm run test:browser`: 120 passed and 1 failed with the live server exiting at start-up (`auto-confirm`), which passed twice when run again. The Checklists browser test opens its own fold now that Services comes first
