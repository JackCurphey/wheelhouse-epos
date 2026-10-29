# Tasks

## 1. Server and screen (one pull request, `jack/your-data-download`)

- [ ] 1.1 Tests first: migration 108 from an empty scratch database and run twice (`tests/migration-108.test.js`); the zip writer read back by `unzip` (`tests/zip.test.js`); the route (`tests/your-data-copy.test.js`: what's in each file, nothing of another customer's, a formula-looking cell made safe, signed out or another shop refused and not logged, another website refused, the log written, a merge and Undo moving it). Watch each fail
- [ ] 1.2 Migration 108; `privacy_requests` in the merge's moved tables
- [ ] 1.3 `server/lib/zip.js`; the route in `server/routes/portal.js`
- [ ] 1.4 Screen tests first (`tests/screens/account-your-data.test.js`: the card, the green bar with the file name, the warning with Try again), watched failing; then the card and bars in `src/screens/book/account.tsx`
- [ ] 1.5 Browser test (`tests/browser/your-data.spec.ts`): Maya downloads her copy and gets a zip
- [ ] 1.6 Break each key rule on purpose, see its test go red, and restore
- [ ] 1.7 Log choices in Jack’s section of `decided-while-building.md`; lint, `npm test`, `npm run test:browser`, the generator's consolidate tests; `/review` (public route and migration); self-review against this spec
- [ ] 1.8 `/opsx:archive` as the last commit
