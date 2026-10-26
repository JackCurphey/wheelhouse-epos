# Tasks

- [x] 1.1 Tests first, each watched failing:
  - migration 085 from an empty scratch database;
  - routes: add, list, change, remove; refusals; Owner only;
  - sending: after collection, before a booked job, after a sale; only
    with the yes; not for a sale with no customer; not before
    `active_from`; not while closed; once per job or sale; the channel
    rules; the subject; Stop stops just that one; remove undoes waiting
    ones; the check before sending.
- [x] 1.2 Build design 1 to 7; update `tests/fixtures/route-list.txt`; log
  design 8 in `decided-while-building.md`.
- [ ] 1.3 `/review` (migration, messaging core); lint, `npm test`,
  `npm run test:browser`; pull request; archive as the last commit.
