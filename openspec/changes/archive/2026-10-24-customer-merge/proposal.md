# Proposal: possible duplicates and Merge, with a 30-day undo

## Why

A customer added twice (two tills offline, a phone answered twice) splits
their history. The customer service review decided a match is caught while
adding (5, built), one that slipped through is flagged on the page, and
nothing merges by itself; staff merge with "The same person?", showing only
what differs (12). The 21 Oct decision (`2026-10-21-sign-up-joins-by-merge.md`)
joins an online sign-up to its customer the same way. Jack, 24 Oct
(`2026-10-24-morning-questions.md` answer 6): a merge can be undone for 30
days; the duplicate is hidden until then, then removed for good.

## What Changes

- **On a customer's page** (`cs-page-dup`): "Might be the same person as
  [name] · same phone number" (or email), with **Check**.
- **The same person?** (`cs-merge`): each record's jobs and sales counted, only
  what differs shown, a choice of which to keep for each, "They're different
  people" (not flagged again) and **Merge into one**.
- **Merging** moves everything of the other record to this one in one go
  (bikes, jobs, sales, orders, messages, till sales, groups, an online account),
  records exactly what moved, and hides the other record.
- **Undo the merge** on the page for 30 days puts everything back; after 30
  days the hidden record is removed for good.
- **Migration 068**: the merge record, the "different people" pairs, and which
  customer a hidden one was merged into.

## Capabilities

### Modified Capabilities
- `customers`: possible duplicates, Merge and its undo.

## Lane, work package, drawings and decisions

- **Work package:** WP-3.2, Jack (24 Oct). Stacked on #450.
- **Risky areas:** a migration, and it moves sales and orders between
  customers (money's records), so `/review` runs before merging.
- **Drawings:** `cs-page-dup`, `cs-merge` (`customer.mjs` :234–248).
- **Decisions:** customer service review 5, 12; 21 Oct sign-up joins by merge;
  23 Oct answer 5 (no asking each time); 24 Oct answer 6 (30 days).

## Out of scope

- Two records that both have an online account: refused for now, with the
  reason, until Jack says which sign-in survives.
- Finding duplicates by name alone (too many share one).

## Impact

`server/migrations/068_customer_merges.sql`, `server/routes/customer-merge.js`
(new, registered; route list), `src/screens/customers/` (the notice, the pop-up
and Undo).
