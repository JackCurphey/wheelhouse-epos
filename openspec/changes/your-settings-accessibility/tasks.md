# Tasks

## 1. The server

- [ ] 1.1 Migration 065 (`login_preferences`, row-level security). Tested from empty on a scratch database
- [ ] 1.2 Tests first (`tests/your-settings.test.js`): every switch off to start; a change saves for this login only and comes back whole; an unknown switch or a value that isn't true/false is refused; signed out is refused; another shop's login never shares a row. Watch each fail
- [ ] 1.3 Build `server/routes/your-settings.js` (registered; route list). Verify 1.2

## 2. The screens

- [ ] 2.1 Tests first (`tests/screens/your-settings.test.js`): your name opens Your settings as drawn; Larger text and Reduce motion switch, saved at once, and the page's classes follow; Close goes back. Watch each fail
- [ ] 2.2 Build `src/screens/your-settings/`, the classes on `<html>`, the CSS, and `prefersReducedMotion()`. Verify 2.1; a browser test at phone and computer widths (larger text doesn't widen the page)
- [ ] 2.3 Log what's decided while building; `/review`; lint, tests; archive as the last commit
