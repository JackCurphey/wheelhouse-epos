# Tasks

## 1. Server and screen (one pull request, `jack/your-data-download`)

- [x] 1.1 Tests first: migration 108 from an empty scratch database and run twice (`tests/migration-108.test.js`); the zip writer read back by `unzip` (`tests/zip.test.js`); the route (`tests/your-data-copy.test.js`: what's in each file, nothing of another customer's, a formula-looking cell made safe, signed out or another shop refused and not logged, another website refused, the log written, a merge and Undo moving it). Watch each fail
- [x] 1.2 Migration 108; `privacy_requests` in the merge's moved tables
- [x] 1.3 `server/lib/zip.js`; the route in `server/routes/portal.js`
- [x] 1.4 Screen tests first (`tests/screens/account-your-data.test.js`: the card, the green bar with the file name, the warning with Try again), watched failing; then the card and bars in `src/screens/book/account.tsx`
- [x] 1.5 Browser test (`tests/browser/your-data.spec.ts`): Maya downloads her copy and gets a zip
- [x] 1.6 Break each key rule on purpose, see its test go red, and restore
- [x] 1.6a Reviews of #587: the sign-in read again under a shared lock, files marked UTF-8, a refund a number, the file let go on leaving; then 10 copies per sign-in in 15 minutes, the sign-in recorded so Undo of a merge sends its copy back, the purchase day from the database, and more checks (formula prefixes, same-site, another shop, notes, removed bikes, company fields and answers, 108's write check). Tests first, each watched failing, each rule broken on purpose
- [x] 1.7 Log choices in Jack’s section of `decided-while-building.md`; lint, `npm test`, `npm run test:browser`, the generator's consolidate tests; `/review` (public route and migration); self-review against this spec
- [x] 1.8 `/opsx:archive` as the last commit
