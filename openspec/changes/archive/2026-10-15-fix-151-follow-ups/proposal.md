# Proposal: two follow-ups from Jack's review of #151 and #156 (WP-0.4)

## Why

Jack reviewed Mark's twelve WP-0.4 pull requests after they merged (#151,
comment of 7 Oct) and found two small gaps in Mark's files:

1. `scripts/ci/check-migrations.mjs` and `scripts/dev/new-db.mjs` silently
   do nothing when started through a symlinked path, such as a worktree
   under macOS's `/tmp`. A local check would pass without checking anything.
2. No test reaches the purchase-order edit route's handling of a bad line
   (`PUT /api/purchase-orders/:id`), so a break there would be a silent 500.

His third point (`server/routes/products.js` awaiting the Shopify stock push
while holding its database connection) changes behaviour, so it is its own
change.

## What Changes

- Both scripts compare real paths, as `scripts/ci/assert-screen-trace.mjs`
  already does. A new test runs each one through a symlink.
- A new test sends bad lines to the purchase-order edit route and expects a
  400 with the same messages as create, with the order left unchanged.
- No behaviour a shop would see changes (`skip_specs`).

## Lane, drawings and decisions

- **Lane:** Mark's (`scripts/ci/**`, `scripts/dev/**`, server tests; split
  plan §3). **Drawings:** none.
- **Follows:** Jack's review on #151 (7 Oct), points 1 and 2.

## Out of scope

- Point 3 (`products.js` and the Shopify push), which is its own change.

## Impact

- `scripts/ci/check-migrations.mjs` and `scripts/dev/new-db.mjs`;
  `tests/scripts-run-through-symlink.test.js` (new); and
  `tests/purchase-orders-validation.test.js`.
