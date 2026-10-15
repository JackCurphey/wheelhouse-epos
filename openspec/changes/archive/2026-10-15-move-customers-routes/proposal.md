# Proposal: customers, their groups and bikes move to server/routes/customers.js (WP-0.4)

## Why

One of WP-0.4's remaining moves: the customer area is still in `server.js`.

## What Changes

- New `server/routes/customers.js`, Mark's file, with 15 routes:
  `/api/customer-groups` (GET, POST, PUT, DELETE); `/api/customers` (list,
  one, a customer's sales, create, update, delete); and the customer's bikes
  (`/api/customers/:id/bikes` GET and POST, `/api/bikes/:id` PUT and DELETE,
  `/api/bikes/:id/jobs`).
- Their helpers (groups, discount percent, serializing and listing
  customers) come with them. Nothing outside these routes uses them.
- Moved, not rewritten: only the 2-space indent inside `register(route)` and
  the imports change. No behaviour changes (`skip_specs`).

## Lane, drawings and decisions

- **Lane:** Mark's (customers are Mark's, split plan §3; and `server.js`).
- **Drawings:** none.
- **Decisions followed:** split plan §4.1.

## Out of scope

- The sales routes and sale documents (the next moves).

## Impact

- `server/routes/customers.js` (new), `server/routes/index.js`,
  `server/server.js`, and the new test `tests/customers-routes-file.test.js`.
  Built on #211.
