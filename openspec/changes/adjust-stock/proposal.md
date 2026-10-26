# Proposal: adjust stock, with a reason and who

## Why

A product's page shows its stock and history, but nothing can correct it.
Stock control decision 6 (`docs/decisions/2026-10-01-stock-control-review.md`)
says "Adjust stock" on a product takes the change (or the count after it)
and a reason from a short list, and every adjustment goes into the
product's stock history with who made it. Decision 11 adds that no reason
is picked until one is, the reasons follow the sign, and Other needs a
note. Slice C, WP-2.1, Jack's lane, on the 26 Oct defaults.

**Risky area:** money and stock (`stock_qty`), and a migration. `/review`
runs before merging. How sales and till sync take stock down is not
touched (`server/till/sync.js`, `server/lib/sales.js`: Mark's step C).

## What Changes

- **Migration 089:** `stock_movements` gains `reason` (one of the drawn
  reasons, or empty for older lines and other kinds of movement) and
  `login_id` (who made it). Additive; the note column already exists.
- **`POST /api/products/:id/stock`:** Owner only (`ownerOnly`). An
  adjustment needs a reason that fits the sign, and Other needs a note. It
  records who. Stock changes in one atomic update
  (`stock_qty = stock_qty + change`), so two adjustments at once both count.
- **`GET /api/products/:id`:** each history line carries its `reason` and
  `who` (the login's name).
- **A product's page:** "Adjust stock" in the In stock box, for the Owner
  only, opens the Adjust stock box (`st-adjust`, `st-adjust-faulty`); the
  history says "Adjusted · [reason]", the note, and who.

## Drawings and decisions

- Drawings: `st-adjust`, `st-adjust-faulty`, and the In stock box and
  history lines of `st-product`
  (`docs/design/user-journeys/generator/stock.mjs`, `summary`, `histRow`,
  `adjustPopup`).
- Decisions: stock control 6 and 11; UX walk-through 3 L2 and L4 (Faulty —
  to return to supplier; the greyed Adjust says why).

## Out of scope

- The To return list in Deliveries and orders: Faulty is recorded as the
  reason, but nothing puts it on a list yet, so the box doesn't promise it.
- Big adjustments on the manager's Today, and its Settings › Stockroom
  amount (`st-today-adjust`, `st-setting-adjust`).
- Staff adjusting: until roles (WP-1.1) only the Owner adjusts.
- Send to another shop, Edit, and the stock take.

## Capabilities

### Modified Capabilities

- `stock`: a product's page can adjust its stock.
