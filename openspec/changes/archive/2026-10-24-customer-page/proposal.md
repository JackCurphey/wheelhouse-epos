# Proposal: a customer's page, and Edit

## Why

Customers' list and Add (customers-list) open a customer's page, and the
header search's customer rows do too; it isn't built. The customer service
review (`docs/decisions/2026-09-30-customer-service-review.md`) decided one
page with one history (12): what's open now at the top, then everything else,
newest first.

## What Changes

- **The customer's page** (`cs-page`, `cs-page-new`, `customer.mjs` :148–178),
  at `/workshop/customers/[id]`:
  - the back link "Customers", their initials, name, phone and email, and
    **New job**, which opens the diary's New job with them chosen;
  - **Details** with Edit: address and postcode, group, note;
  - **Bikes**: each bike they have;
  - **At a glance**: Happy to hear about offers, as they chose;
  - **History** with Everything, Jobs, Sales and Messages: "Open now" (jobs
    still under way, a ready bike included), then "Earlier, newest first", then
    "Show all ([n])"; "Nothing yet" with New job for someone new.
- **Edit** (`cs-edit`, :314–321): "Edit [name]’s details", "Nothing changes
  until you save", name, phone, email, address, postcode, group, note and
  offers, Save changes.
- **`GET /api/customers/:id/history`**: their jobs, sales and messages, one list.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `customers`: a customer's page and Edit.

## Lane, work package, drawings and decisions

- **Work package:** WP-3.2, Jack (24 Oct). Stacked on customers-list.
- **Risky areas:** none (reads; the edit uses the existing customer route).
- **Drawings:** `cs-page`, `cs-page-new`, `cs-edit`.
- **Decisions:** customer service review 12 (one history), walk-through 9 L5
  (a ready job is still open).

## Out of scope

- "Owes", the account and store credit (money in pence, #404), the bike's own
  page and adding a bike (next), a sale's own page, refunds and credit in the
  history, Merge (after), Privacy requests.

## Impact

`server/routes/customers.js` (history; route list), `src/screens/customers/`
(the page and Edit), `src/staff/routes.ts` and `app-shell.tsx` (the page's
address), `src/screens/diary/diary-page.tsx` (`?customer=` opens New job).
