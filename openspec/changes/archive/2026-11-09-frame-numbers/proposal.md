## Why

Receiving decision 5 records each bike's frame number when it is booked in: scanning a bike in a delivery asks for its frame number (scan the sticker, or type it) before it counts, so every bike in stock is known on its own, and the till later picks which one is sold instead of typing it. Stock control decision 3 then lists a bike's frame numbers first on its page: in stock, or sold and to whom. Neither is built: receiving says frame numbers "come later" (`receive-page.tsx`, and the 26 Oct gap decision 2), and a bike's page notes they "aren't recorded yet". It is the last piece of WP-2.1, Stock control, and the bike warranty in WP-3.2 (Customers) needs a sold bike to carry its frame number.

## What Changes

- **Which products are bikes:** a product whose category, or a category it sits in, is named as bikes ("Bikes", "Road bikes", "Bikes › E-bikes"). Not drawn; decided here for Jack to overrule (`decided-while-building.md`).
- **Receiving asks for a bike's frame number** (`rs-frame`): scanning or picking a bike opens "Frame number", "[Bike name] · bike [n] in this delivery", with "Scan the sticker on the frame, or type it". Enter (a scanner presses it) or "Count this bike" counts it; Cancel doesn't. "Each bike is then known by its frame number — the till picks it at the sale, and its warranty starts from the right bike."
- **A frame number already in stock is caught** (`rs-frame-dup`): "This frame number is already in stock — booked in [date]. Check the sticker, or scan the next bike." Also one already scanned in this delivery.
- **The line shows its frames** (`rs-receive-marked`): "[Supplier code] · Frame [frame number] · Frame [frame number]". A bike's count goes up only by scanning one; stepping it down takes off the last frame scanned.
- **Booking in records each frame** against the product, the shop, the delivery and who, in stock.
- **A bike's page** (`st-product-bike`): "Bikes by frame number", each "Frame [frame number]" with In stock and "Booked in [date] from [Supplier]". Its history's received line reads "Received · delivery from [Supplier]", "[n] frame numbers", opening the delivery.
- **Stock** (`st-list`): a bike's line reads "[Category] · [n] bikes, each by frame number".
- **Ready for the sale:** each frame keeps room for the sale, the customer and the customer's bike it becomes, so the till's "Which one?" (`till-serial`, WP-3.1) and the warranty (WP-3.2) can carry it.
- **Server (stock: risky; a migration: risky):** migration 125 (`stock_frames`); `GET /api/stock-frames/check`; booking in (`POST /api/deliveries/receive`) takes each bike's frames; products say whether they are bikes; a product's page sends its frames; stock lines send their delivery.

## Out of scope

Selling a bike by its frame (`till-serial`, `till-serial-held`, WP-3.1, the till, Mark's sales area). Holding a frame for Cycle to Work (`rs-frame-c2w`, `cw-*`, the Cycle to Work piece). A bike's warranty (WP-3.2). The header search finding stock frames (walk-through 2 decision 12, the header search's piece). The old app's receive route (`POST /api/purchase-orders/:id/receive`, a placeholder to delete) asks for none.

## Who and risk

WP-2.1, Jack's side. Receiving stays with everyone (receiving decision 4). Risky: **migrations** (125) and **money and stock** (booking in). `/review` before each merge and a hand-run CI. Pull requests: (1) the server and migration; (2) the Frame number box on receiving, the bike's page and Stock's line, then the archive.

## Follows

- Decisions: `docs/decisions/2026-09-30-receiving-stock-review.md` decisions 4 (everyone receives) and 5 (a bike's frame number when it's booked in), and its audit (a frame sticker counts itself, a frame number already in stock is caught); `docs/decisions/2026-10-01-stock-control-review.md` decision 3 (a bike's page lists its frame numbers first) and its later change of 2 Oct (Held for Cycle to Work); `docs/decisions/2026-09-29-selling-at-the-till-review.md` (the till's "Which one?", later); `docs/decisions/decided-while-building.md`, 26 Oct receiving point 2 (frame numbers left for later).
- Drawings: `rs-frame`, `rs-frame-dup`, `rs-receive-marked` (`receiving.mjs`, lines 99–158), `st-product-bike`, `st-list` (`stock.mjs`, lines 75, 172–178).
- Built: `openspec/specs/deliveries`, `openspec/specs/stock`.

## Capabilities

### New Capabilities

### Modified Capabilities
- `deliveries`: receiving a bike asks for its frame number; booking in records it.
- `stock`: a bike's page lists its frame numbers; Stock's line says how many bikes by frame number.

## Impact

`server/migrations/125_stock_frames.sql`, `server/lib/bikes.js` (new), `server/routes/stock-frames.js` (new), `server/routes/purchase-orders.js` (booking in), `server/routes/products.js` (a product's page), `server/routes/stock-list.js`, `server/lib/serializers.js`, `server/routes/index.js`, `tests/fixtures/route-list.txt`; `src/screens/deliveries/receive-page.tsx`, `src/screens/deliveries/frame-number.tsx` (new), `src/screens/stock/product-page.tsx`, `stock-bits.tsx`. Tests: new `tests/stock-frames.test.js`, `tests/migration-125.test.js`, `tests/screens/receive-frames.test.js`, `tests/browser/receive-frames.spec.ts`; `tests/screens/stock-list.test.js`.
