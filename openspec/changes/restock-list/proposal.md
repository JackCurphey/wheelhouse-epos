## Why

Receiving decision 2 gives the Stockroom a restock list: what's running low or has sold a lot lately, grouped by supplier, downloaded as a file for the supplier's website basket or added to an order. Walk-through 3 M1 adds "For customers" (what jobs are waiting for), and the 3 Oct later change M7 puts a job's part on it by itself when there isn't the stock for it. Jack's 27 Oct answer 2 made it wait for proper sizes and suppliers (WP-1.5), which merged on 8 Nov (#632 to #635), and his 4 Nov answer 10 settled that the list matches a product's supplier by name. It is the last missing piece of WP-2.3, Deliveries and purchase orders.

## What Changes

- **Restock list** (`rs-restock`, `rs-restock-customers`), at Deliveries and orders › Restock list: pills All, Running low, Selling fast, For customers; one group per supplier, each with a tick box for the group and for each product, In stock, "Sold, last 28 days" and a Reorder count that can be typed or stepped; "[n] ticked", **Add to an order** and **Download for [Supplier]’s basket** under each group. For customers shows each waiting line with "for job WH-1042 · Maya Patel · promised [date]".
- **On Deliveries and orders** (`rs-hub`): a Restock list section with Running low, Selling fast and For customers, each with how many and "See the list".
- **On Today** (`rs-today-restock`): "[n] new products running low, selling fast or for customers", "Since the restock list was last opened · [n] for jobs or online orders", Open; it clears when the list is opened or downloaded.
- **Add to an order** puts the ticked lines on that supplier's draft order (making one if there isn't one) and opens it; a line for a job keeps "for job WH-1042" on the order's line, so it leaves For customers once ordered.
- **Server (money and stock: risky; a migration: risky):** migration 123 (an order line's job; when each person last opened the list); `GET /api/restock`, `POST /api/restock/add-to-order`, `POST /api/restock/download` (a CSV file), `POST /api/restock/seen`; Today's needs-attention gains `restock_new`.
- The four details Jack's 27 Oct answer left open are settled here as defaults for him to overrule (`decided-while-building.md`): selling fast, the suggested count, the file's columns, and where For customers comes from.

## Out of scope

Online orders that "order in" an item (the buy-online decisions' "items we can order in"): Wheelhouse has no such order yet, so For customers lists jobs only. A job's part line reading "On order" on the job's page (walk-through 3 M7's second half, a workshop job page drawing). Each supplier's own basket format (the drawing leaves it "to be checked for each supplier"). Supplier feeds and sending an order (`po-feed`, `po-send`). Who besides the Owner sees the list waits for roles (WP-1.1), as orders do.

## Who and risk

WP-2.3, Jack's side. Owner-only for now, like orders ("Only the shop's owner can order stock"), until Mark's roles. Risky: **migrations** (123) and **money and stock** (it reads stock and writes order lines). `/review` before each merge, and a hand-run CI. Pull requests, stacked: (1) the server; (2) the Restock list screen, the hub's section and Today's line, then the archive (Today's line was folded into the second, being 75 lines).

## Follows

- Decisions: `docs/decisions/2026-09-30-receiving-stock-review.md` decision 2, decision 4 (who), decision 10 (the audit: M6 grouped by supplier, M11 and L6 Today's line), decision 11 (phone), later changes of 3 Oct (walk-through 3 M1 and M7); `docs/decisions/2026-10-27-answers.md` answer 2; `docs/decisions/2026-11-04-answers.md` answer 10; `docs/decisions/decided-while-building.md` 26 Oct deliveries point 2.
- Drawings: `rs-restock`, `rs-restock-customers`, `rs-today-restock`, `rs-hub` (`receiving.mjs`, `opening.mjs`).
- Built: `openspec/specs/deliveries`, `openspec/specs/stock`, `openspec/specs/today`.

## Capabilities

### New Capabilities

### Modified Capabilities
- `deliveries`: the restock list, its downloads, Add to an order, an order line's job, and the hub's Restock list section.
- `today`: new on the restock list.

## Impact

`server/migrations/123_restock.sql`, `server/lib/restock.js` (new), `server/routes/restock.js` (new), `server/routes/index.js`, `server/routes/purchase-orders.js` (an order line's job kept and shown), `server/routes/today.js`; `src/screens/deliveries/restock-page.tsx` (new), `deliveries-page.tsx`, `order-page.tsx`, `deliveries-bits.tsx`; `src/screens/today/today-page.tsx`; `src/staff/routes.ts`, `app-shell.tsx`. Tests: new `tests/restock.test.js`, `tests/migration-123.test.js`, `tests/screens/restock.test.js`, `tests/browser/restock.spec.ts`; `tests/needs-attention.test.js`, `tests/screens/today.test.js`, `tests/fixtures/route-list.txt`.
