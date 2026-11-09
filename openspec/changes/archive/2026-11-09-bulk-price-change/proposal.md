## Why

Stock control decision 7 lets the Owner change many prices at once from the stock list: tick products (or search or filter, then tick all), press Change prices, pick a new price for each, a percentage up or down, or a target margin, round to an ending such as .99, and see old and new prices side by side before anything changes. Decision 11 (the UI audit) adds Undo straight after, "Apply to [n] products", and tick boxes always on the list. Nothing of it is built: the list has no tick boxes and no Change prices. It is one of the last two pieces of WP-2.1, Stock control. Price changes have been kept in each product's history since #632 (8 Nov); a bulk change writes the same lines.

## What Changes

- **Ticking on Stock** (`st-list-ticked`): a tick box on each row and "Tick all [n] shown" at the top of the list; with any ticked, a bar: "[n] ticked", Untick all, Change prices. Ticks stay while searching and filtering, so products can be gathered from several searches.
- **Change prices** (`st-prices`): a box titled "Change prices", with what's ticked under the title; How: A new price for each, Up or down by a percentage, or A target margin; Change by [n] % or a target margin %; Prices end in: Leave as they are, .99, .00; a table of each product with Now, New (with "Below cost" when the new price is under its cost) and Margin before → after; on a phone each product stacked (Now → New, then Margin). "Nothing changes until you press Change. You can undo it straight after; each change goes into the product's history." Cancel and "Change [n] prices".
- **Prices changed** (`st-prices-done`): the ticks clear and a message says "Prices changed · [n] products" with Undo, which puts back every price the change made that nobody has changed since.
- **Each change goes in the product's history**, as an edited price does: "Price changed · £28.00 → £[price]", with who and when; an Undo writes its own line back.
- **Server (money: risky; a migration: risky):** migration 124 (a price change belongs to a bulk change, which records who made it and whether it was undone); `POST /api/stock/prices/preview`, `POST /api/stock/prices`, `POST /api/stock/prices/:id/undo`. The preview and the change work prices out the same way, in one place, from the prices as they are when the change is made.

## Out of scope

Print labels and Send to another shop on the ticked bar (drawn on `st-list-ticked`, but labels and sending between shops are their own pieces, not built yet; the bar shows them when they are). Price rules that run by themselves (decision 7 chose against them). Staff ticking: the only thing the bar offers now is the Owner's Change prices, so tick boxes show to whoever can change prices until labels and sending exist. Who besides the Owner changes prices waits for roles (WP-1.1), as editing a product does.

## Who and risk

WP-2.1, Jack's side. Owner-only for now ("Only the shop’s owner can add or change products"), until Mark's roles. Risky: **migrations** (124) and **money and stock** (it changes prices). `/review` before each merge and a hand-run CI. Pull requests, stacked: (1) the server and migration; (2) ticking, the Change prices box and Undo on Stock, then the archive.

## Follows

- Decisions: `docs/decisions/2026-10-01-stock-control-review.md` decisions 7, 11 (the audit: Undo, "Apply to [n] products", tick boxes always on, Staff can't change prices) and 12 (phone: the preview stacks each product); Reports and accounts decisions 5 and 9 (who sees cost and margin).
- Drawings: `st-list-ticked`, `st-prices`, `st-prices-done` (`docs/design/user-journeys/generator/stock.mjs`, lines 87, 189–204).
- Built: `openspec/specs/stock` (price history, cost visibility, prices in whole pence, the most a price can be, a save never hanging on a locked product).

## Capabilities

### New Capabilities

### Modified Capabilities
- `stock`: ticking products on Stock, changing their prices together with a preview, and Undo.

## Impact

`server/migrations/124_price_change_batches.sql`, `server/lib/bulk-prices.js` (new), `server/lib/price-changes.js` (a change's batch), `server/routes/bulk-prices.js` (new), `server/routes/index.js`, `tests/fixtures/route-list.txt`; `src/screens/stock/stock-page.tsx`, `src/screens/stock/change-prices.tsx` (new). Tests: new `tests/bulk-prices.test.js`, `tests/migration-124.test.js`, `tests/screens/change-prices.test.js`, `tests/browser/change-prices.spec.ts`.
