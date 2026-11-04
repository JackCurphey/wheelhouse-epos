## Why

Products and stock come across (`citrus-import-products`, `citrus-import-screens`). WP-2.4's other half of the shop's data is its customers and their bikes.

## What Changes

- Top Customers becomes customers, each with their address, offers yes or no, and the date of that yes. Service Items Report becomes their bikes, matched by email, then phone, then name, as it has no account number.
- A row that doesn't fit waits for a look: no name, looks like the same person as someone already here, a bike whose customer can't be found.
- Someone already brought across is left alone, so a file can be sent twice. A customer who asked for their details to be deleted never comes back from a file: only one-way codes of them are kept to spot them (Jack, 3 Nov).
- Deleting someone's details removes a waiting row with their account number; a row that only shares their email or phone stays as needs a look, with no link to them (Jack, 4 Nov).
- The page's Customers row works, with the bikes counted beside it.

## Out of scope

Look at the [n], Fix, Leave it out, `mv-sorted` and Ask us to help (next pull request). Customers who never bought, whom Top Customers may leave out (a shop's full export, on the first Citrus Lime shop that moves). Account balances (WP-8.1).

## Who and risk

WP-2.4, Jack's. Risky areas: **migrations** (112) and **customer accounts** (customers' details, the deletion path).

## Follows

- Drawings: `mv-start`, `mv-progress`, `mv-summary`, and the "why" wording of `mv-fix` (`moving.mjs`).
- Decisions: `docs/decisions/2026-09-30-moving-from-citrus-lime-review.md` 2, 3; `docs/decisions/2026-10-30-answers.md` 3 (what deleting means); `docs/decisions/2026-10-26-customer-account.md` (a code sign-in joins only an email the customer gave themselves).
- Build plan WP-2.4: consent and its date; bikes matched by name, email or phone. Columns: `docs/superpowers/specs/2026-10-05-citrus-lime-exports.md`.

## Capabilities

### New Capabilities

### Modified Capabilities
- `moving-from-citrus-lime`: customers and their bikes.

## Impact

Migration 112, `server/move/`, `server/privacy-requests.js`, `src/screens/moving/move-page.tsx`.
