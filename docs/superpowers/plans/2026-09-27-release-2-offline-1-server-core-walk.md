# Release 2 offline plan 1 (server core) — spec walk

Plan: `docs/superpowers/plans/2026-09-27-release-2-offline-1-server-core.md`
Spec: `docs/superpowers/specs/2026-09-27-release-2-foundations-offline-design.md`
Branch: `feat/release-2-design` (not merged, not pushed)

## Step 1: full check

```
npm run typecheck && npm run lint && npm run migrate && node scripts/ci/assert-rls-coverage.mjs && npm test && npm run migrate
```

All steps exited 0. Tail of `npm test`:

```
ℹ tests 1344
ℹ suites 0
ℹ pass 1344
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 86021.72325

> bike-shop-epos@1.0.0 migrate
> node server/migrations/run-migrations.js

Migrations up to date.
```

RLS coverage: 43 tables with a `shop_id` column, 41 required to be protected, 2
exempt (`customer_logins`, `logins`); coverage OK. Final `migrate` applied
nothing (migrations up to date both before and after the suite ran).

No failures.

## Step 2: spec walk

### Met in plan 1

- §3 "when the connection returns" (server side): waiting sales are accepted
  exactly once, stock goes down, below-zero lands on the "check these" list.
- §4: PIN storage (hashed) and check-in recording.
- §5: registration, credential, snapshot, exactly-once sale acceptance,
  receipt numbers, stock never blocks a sale.
- §6: data changes (pence, VAT on sale lines, sites/tills/staff PINs/staff
  check-ins tables, till provenance columns on sales, no stock refusal).
- §7 default 1: new customers can be added offline, possible duplicates
  flagged for merge by hand.
- §8: manager view data (till list, last sync, sales waiting), a sale the
  server cannot accept is never discarded, the price charged at the till
  stands.
- §9 tests 1, 2, 3, 6, 7 (server side): a repeated sale id is recorded once;
  sales arriving out of order end up correct; an offline sale reduces stock
  on sync and flags below-zero stock; receipt numbers never clash between
  tills; a connection dropped part-way through sending neither loses nor
  doubles a sale.

### Deferred to plan 2 (till core)

- The service worker and page loading offline.
- Local storage (IndexedDB) of products, prices, VAT, customers, staff PINs,
  site/till identity, receipt counter, and the queue of sales waiting to
  send.
- The queue itself and its retry/resend behaviour on the till side.
- The four-hour banner rule.
- Refusing sign-out, unregistering, or clearing storage while sales are
  waiting.
- Requesting persistent storage from the browser.
- §9 tests 4 and 5: a PIN check works with no connection; the till page
  loads with the network cut.
- The till must keep items the server returns as `status: 'failed'` (sales
  and check-ins) rather than dropping them.

### Deferred to plan 3 (screens)

- Registering a till.
- The check-in screen.
- The offline banner itself (UI).
- The manager's tills view and attention list (UI over the data plan 1
  built).

### Deferred to piece 4 (customers)

- §7 default 3: credit-account sales checked against the limit on sync, and
  loyalty points added on sync. No account or loyalty data exists yet; an
  `'account'` payment is recorded now and flagged `unsupported_payment_method`
  so it is never silently accepted or discarded.

### Changed

- **Till credential never expires**, rather than renewing itself while
  online (spec §5). Switching a till off centrally withdraws it. Flagged to
  Jack as a plan decision.
- **Till auth rate limiting counts failures only**, keyed on address + shop
  slug (not every request). The spec's implied per-request limiter would
  have let a post-outage sync burst, or a dead neighbouring till, lock out a
  working till.
- **Sync results are per item, not per batch.** An item the server cannot
  store returns `status: 'failed'` with a reason, and the rest of the batch
  continues; a whole-batch `400` is reserved for a malformed request shape
  (bad body, missing `clientId`/`kind`). The till must keep failed items so
  they can be looked at (plan 2's job).
- **A check-in for an unknown staff member returns `'failed'`**, not
  `'recorded'`, so it is never silently swallowed.
