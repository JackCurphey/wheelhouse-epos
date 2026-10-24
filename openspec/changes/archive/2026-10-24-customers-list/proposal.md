# Proposal: Customers, the list and Add a customer

## Why

Customers (WP-3.2, journey 15) is still the old app. The customer service
review (`docs/decisions/2026-09-30-customer-service-review.md`) decided one
search, the header's, with Customers becoming a recent list (12), and a match
caught while adding, before anyone is added twice (5). The header search is
built first (24 Oct answer 7); this is the next piece.

## What Changes

- **Customers** (`cs-list`, `customer.mjs` :184–189): "Recent customers", the
  note "To find anyone else, use the search at the top — by name, phone,
  email or postcode.", "+ Add a customer", and a row per customer (initials,
  name, their latest bike, phone) opening their page.
- **Add a customer** (`cs-add`, `cs-add-match`, `customer.mjs` :207–221): name,
  phone and email ("A phone number or an email — at least one."), address and
  postcode (optional), group (optional, when the shop has groups), a note, and
  "Happy to hear about offers" (off). While typing, a customer with the same
  phone or email shows ("Maya Patel already has this number") with "Use Maya
  Patel", before anyone is added twice.
- **Migration 067**: a customer's address and postcode; the header search finds
  a postcode.
- **The server** keeps `address`, `postcode` and `marketingPermission`, lists the
  recent customers, and finds possible matches.

## Capabilities

### New Capabilities
- `customers`: the staff app's customers, starting with the list and adding.

### Modified Capabilities
- None (the header search gains the postcode through its own change, #448).

## Lane, work package, drawings and decisions

- **Work package:** WP-3.2, Jack (24 Oct). Stacked on the header search.
- **Risky areas:** a migration, so `/review` runs before merging.
- **Drawings:** `cs-list`, `cs-add`, `cs-add-match`.
- **Decisions:** customer service review 3, 5, 12; booking spec (offers start
  off); 24 Oct answers 6 and 7.

## Out of scope

- A company or club (its VAT number and invoices wait on the accountant, review
  :75–79), the "Owes" chip (money in pence, #404), Privacy requests (later).
- The customer page and Edit (next change), Merge (after).

## Impact

`server/migrations/067_customer_address.sql`, `server/routes/customers.js`,
`server/routes/search.js` (postcode); `src/screens/customers/` (new);
`src/staff/app-shell.tsx` (registered).
