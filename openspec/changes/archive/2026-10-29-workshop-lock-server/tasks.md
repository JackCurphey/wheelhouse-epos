# Tasks

## 1. Server (one pull request, `jack/workshop-lock-server`)

- [x] 1.1 Tests first: migration 105 from an empty scratch database and run twice (`tests/migration-105.test.js`); the lock (`tests/workshop-lock-server.test.js`: the cookie deleted, changed, or swapped for a till's key leaves the Owner's session locked, from setup and from a session that signed in later; the Owner's own PIN on that computer still opens it; signing out ends it; an ordinary browser and a till are unchanged). Watch each fail
- [x] 1.2 Migration 105; mark the session at setup and on a request with the key; the rule in `decide()`
- [x] 1.2a Review of #578: one helper for the Owner's pages and the sign-in's own PIN and settings, staff sign-ins marked too; a WorkOS sign-in's WorkOS session ended when it becomes a workshop computer's (revoke). Tests first, each watched failing, each rule broken on purpose
- [x] 1.2b Re-review of #578: a revoke WorkOS didn't take is tried again on a later request, at most once a minute for a session. Test first, watched failing, both rules broken on purpose
- [x] 1.3 Break each key rule on purpose, see its test go red, and restore
- [x] 1.4 Log choices in Jack’s section of `decided-while-building.md`; lint, `npm test`, `npm run test:browser`; self-review against this spec
- [x] 1.5 `/opsx:archive` as the last commit
