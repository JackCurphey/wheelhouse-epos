# Design

## Context

- **What is built:**
  - Settings' frame (`src/screens/settings/settings-page.tsx` `OwnerSettings()`, rooms → areas → folds, Saved · Undo).
  - Front desk › Till: receipts, tills and signing-in folds, with no quick buttons.
  - Front desk › Payments: Ways to pay (`ways-to-pay-settings.tsx`), with store credit and customer accounts only (`/api/payment-settings`, `payment_settings` table), and Customer groups.
  - Front desk › End of day: Float only (`end-of-day-settings.tsx`, `/api/end-of-day-settings`, `shops.float_pence`).
  - The till's left side lists every active workshop service (`till-page.tsx:147`).
  - Close the day shows from a fixed hour before closing (`server/lib/close-entry.js` `entryFor`, `- 60`) and always counts blind (`close-the-day.tsx`). The server already sends `expectedPence` with the day.
- **Pattern to copy for each save:** the signing-in settings route in `server/routes/shop-settings.js`: `ownerOnly`, BEGIN, SELECT … FOR UPDATE, UPDATE … RETURNING, COMMIT (the "two settings saved at the same moment both stay" requirement).

## Goals / Non-Goals

**Goals:**
- Quick buttons set up in Settings and shown on the till.
- Close the day's timing chosen by the shop.
- Count first as a switch.
- Ways to pay's Cash card.

**Non-goals:**
- Anything that changes what Take payment offers or what a sale, payment or close writes.
- Staff and roles.
- The card machine.

## Decisions

### 1. Quick buttons: two tables (migration, PR 1)

- `quick_button_groups`: `id`, `shop_id`, `name` (1–20 characters, unique per shop, ignoring capital letters), `position`.
- `quick_buttons`: `id`, `shop_id`, `group_id` (deleted with its group), `product_id` *or* `service_id` (a CHECK that exactly one is set), `label` (1–40 characters, nullable; empty means the item's own name), `position`.
- Both tables get row-level security on `shop_id`, as every shop table has.
- **No price column**, so the price always comes from the product (owner setup decision 5, "a quick button's price always comes from its product").
- **Existing shops** (Jack's answer 1): the migration copies each existing shop's active workshop services into a "Workshop" group, in the order the till lists them today, with no label. Shops that sign up later get no groups.
- Positions are whole numbers. A move rewrites the group's positions in one transaction that holds the group's rows FOR UPDATE.

**Routes** (new file `server/routes/quick-buttons.js`, Owner only for changes):

| Route | What it does |
|---|---|
| `GET /api/quick-buttons` | Groups with their buttons, each joined to its product or service for name, kind, line and current price, and `onSale`. Anyone signed in can read it, because the till uses it. |
| `POST /api/quick-button-groups` | Add a group. |
| `PUT /api/quick-button-groups/:id` | Rename or move a group. |
| `DELETE /api/quick-button-groups/:id` | Remove a group. Returns 409 `has_buttons` with a count unless `?confirm=1`. |
| `POST /api/quick-buttons` | Add a button (`groupId`, `productId` or `serviceId`, `label`). |
| `PUT /api/quick-buttons/:id` | Change a button's item, label, group or position. |
| `DELETE /api/quick-buttons/:id` | Remove a button. Undo re-adds it at its old position, as the services fold's Undo does. |

The Add box searches `GET /api/products?search=` (products on sale) and the active services from `GET /api/workshop-services`. Both are built routes and need no change.

### 2. The till reads quick buttons (PR 3, waits for Mark's yes)

- `till-page.tsx`'s left side swaps `services.data.filter(active)` for `GET /api/quick-buttons`.
- It shows pills for groups that have at least one button on sale, and the grid as drawn (4, 3 and 2 columns).
- A tap calls the existing `add({ type: 'product', … })` or `add({ type: 'service', … })` with the item as the till already loads it. `add()` itself is not changed.
- The till's own search and the basket are not changed.
- **Mark's area:** this file is the till's sale screen. Nothing here writes, but it is his to agree before PR 3 merges.

### 3. Close the day timing and Count first (migration, PR 4)

- Two new columns on `shops`, beside `float_pence`:
  - `close_entry_minutes` (0, 30 or 60).
  - `count_first` (boolean, default true).
- `shops` is one row per business today. When sites come (WP-5.2), Count first stays business-wide and Close the day follows each site's closing time.
- The column default is 30, and the migration gives existing shops 30 too, moving them from the old fixed hour (decision 18; Jack's answer 2).
- `/api/end-of-day-settings` GET/PUT gains `closeEntryMinutes` and `countFirst`, using the same FOR UPDATE pattern and refusing any other value with 400.
- `entryFor(hours, minutes, closed, before)` uses `before` in place of 60. `closeEntryNow()` reads it from `shops`.
- `GET /api/close-the-day` gains `countFirst`. `close-the-day.tsx` shows the expected figure and live difference when it is false.
- **Mark's area:** none of this writes a close; the saved figures are unchanged.

### 4. Ways to pay: the Cash card only (in PR 4)

- The Cash card is screen only: it goes first in `ways-to-pay-settings.tsx`, "Always on", with no switch.
- There is no table and no route.
- Other ways to pay and the remaining switches wait for their till pieces (Jack's answer 3).
- The change is small, so it rides in PR 4.

### 5. Gaps the drawings don't settle, decided by the closest built pattern

These are logged in `docs/decisions/decided-while-building/2026-11-jack.md` (or the builder's own month file) when built, for Jack to overrule. The lines checked are quoted.

1. **The Counting the cash fold's wording.** Checked: `settings-frame.mjs` eodFolds has only the closed fold "Counting the cash" / "Count first", with no open drawing. Decision 6 says "Blind counting starts on for a new shop … the shop can turn it off in Settings › End of day." Built pattern: a `RowSwitch` row, as Signing in's Trust PIN. The line "Count the cash before seeing what the till expects." and the summary "Show the expected amount" (from cash-up decision 2's "show the expected amount while counting") are written here.
2. **Edit's box.** Checked: `setup.mjs` draws Edit on hover but no Edit box. It is the Add box with the button filled in and "Save", as Workshop › Services' Change box reuses its Add box.
3. **Adding, renaming and removing a group.** Checked: the drawing shows the "+ Add a group" pill only. It is a small Form box (block 9) asking for the name, and a menu on the pill for Rename, Move and Remove, as Customer groups do. Removing a group with buttons asks first, as Remove on a service with bookings does.
4. **A button whose item is off sale.** Not drawn. "Not on sale" on its Settings row, hidden on the till, as the services list marks an inactive service.
5. **Name limits.** Not drawn. A group name is up to 20 characters (it is a pill) and a button label up to 40, following the closest built limits on the services and customer-groups names.
6. **The till's empty line.** Checked: `till.mjs` doesn't draw an empty quick-button grid. "No quick buttons yet. Add them in Settings." follows today's built line "No workshop services yet. Add them in Settings." (`till-page.tsx:170`) and the Settings empty state's heading.

## Jack's answers (11 Nov)

Recorded in `docs/decisions/2026-11-11-settings-rest-answers.md`:

1. **Existing shops' quick buttons:** their active services are copied into a "Workshop" group (option 1).
2. **Close the day timing:** every shop moves to 30 minutes before closing, including existing ones (option 2).
3. **Ways to pay now:** the Cash card only (option 2). Other ways to pay waits with the other switches.

## Risks / Trade-offs

- **Existing shops' Close the day moves.** It moves from an hour before to 30 minutes before without the shop choosing (Jack's answer 2). The fold shows the new time, and the shop can change it back.
- **PR 3 needs Mark.** Without it, quick buttons can be set up but the till still shows services. PRs 1 and 2 are useful on their own only once PR 3 lands, so ask Mark early.
- **Two migrations.** Each is small and adds only. None changes or drops an existing column.
