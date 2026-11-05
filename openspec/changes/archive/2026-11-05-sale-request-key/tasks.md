# Tasks

## 1. Tests first, each watched failing

- [x] 1.1 `tests/sale-request-key.test.js`: a reset connection then a repeat, two at once, different details, a refused sale's key, another business, no key, an order's payment and its warning.
- [x] 1.2 `tests/migration-116.test.js`.
- [x] 1.3 Screen tests: the same key across retries, a new one for the next sale, a lost answer on a job reaching Paid, `reused_key`'s words.

## 2. Build

- [x] 2.1 Migration 116; both routes.
- [x] 2.2 The till; the old till.

## 3. Check

- [x] 3.1 Each rule broken on purpose, then restored.
- [x] 3.2 The index's lock on a large made-up sales table.
- [x] 3.3 `npm test`, `npm run test:browser`, consolidate, lint, typecheck, check-migrations on the head after merging latest main; self-review; the independent review and `/review` by whoever merges; archive last.
