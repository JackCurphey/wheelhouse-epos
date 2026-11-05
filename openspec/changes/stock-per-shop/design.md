# Design

In the code "shop" is the business and "site" a physical shop; on screen "shop" is a site (WP-1.4 spec §1). Below, "business" and "shop" as a person reads them; column names as they are.

## 1. Two figures, one writer

`product_stock (shop_id, site_id, product_id, qty)` holds each shop's figure; no row is none. `products.stock_qty` stays as the business's total for everything that reads it: the old till, the old sales tables, Shopify, reports, the stock list, low stock, the below-zero warning and `/api/products`. The till's snapshot has no stock in it and hasn't changed.

`moveStock` writes both in one transaction, under the product's lock taken in id order, so `product_stock` needs no lock order of its own and nothing new can hang: it can't wait on a row whose product it doesn't already hold. `tests/stock-movements-one-place.test.js` now also fails on any other write to it. Removing a business clears it with the rest, as every table with `shop_id` is found by name.

The total always equals the sum because of this, not a check in the database. The query that would show otherwise: `SELECT p.id FROM products p LEFT JOIN product_stock s ON s.product_id = p.id GROUP BY p.id HAVING p.stock_qty <> COALESCE(SUM(s.qty), 0)`.

## 2. A first shop

Named after the business, its code the name's first letter, as `ms-add-shop`'s code is "suggested from the name"; A where there's no letter (`123`). Made by `createShop` and migration 117, and by `moveStock` for a business made any other way (tests' `createTestShop`), with `ON CONFLICT` for two at once.

Why the business's name: sign-up asks for nothing else. Today's product page already labels its one figure with the business's name, and `docs/decisions/2026-10-18-shop-details.md` has the business's one set of details moving onto its first site. What this costs: a business in Bolton sees "North Street Cycles", not "Bolton", and its tills are N1, N2, until a screen can change them. Nothing can rename a shop yet (`ms-sites` is WP-1.4/5.2), and a till's code doesn't change with its shop's. Logged for Jack to overrule.

**Till setup** follows the drawing with no new design: Shop as pills, Till number from the shop's letter, "Make this computer Till N1". The undrawn "This business has no shops" goes. Where a till's or workshop computer's strip would read "North Street Cycles · North Street Cycles", it says the name once.

## 3. Which shop

A till or workshop computer's own (`siteHere`); otherwise the business's oldest, until a session has a chosen shop (WP-1.4). Writers aren't changed: piece 2 already passes this as `who.siteId`. Nothing takes a shop from what a request sends, so a request can't name another's. Shopify and the Citrus import are the oldest.

## 4. Below zero

| What | Looks at | Why |
|---|---|---|
| Old till's sale (`neverBelowZero: true`) | The total | Keeps the old till as it is. At a till with none here and stock elsewhere it sells and takes that shop below zero, which is what's physically been recorded; stock never blocks a sale (Release 2 rule 3) |
| Adjust (`neverBelowZero: 'here'`) | This shop | Its screen says "at [shop]", "[n] in stock now" and "In stock after" |
| Paid Shopify order, till sync | Neither | Answers 7 and 8 |

**The below-zero warning, stock list, low stock and the till's "at [n] after the sale" stay on the total**, as `Today` by shop needs the switcher. So with Bolton at 5 and [Second site] at −1, Today doesn't list it. A one-shop business is exactly as before, and no screen can add a second shop yet. The product's page shows the −1, with its own "Below zero" tag.

## 5. What the migrations cost

Large made-up tables on a scratch database, under the app role, with a stock write, a line added, a product read, a history read and a stock take read tried every 20 ms throughout, each with the 2-second limit.

| Size | 117 | A stock write or a count meanwhile | Reads | 118 | Everything meanwhile |
|---|---|---|---|---|---|
| 100,000 products, 100,000 lines | 0.2 s | waits up to 0.2 s | no wait | 1.4 s | no wait to speak of |
| 1,000,000 products, 3,000,000 lines | 1.7 s | waits up to 1.7 s, none told busy | under 20 ms | 46 s | under 90 ms |

- **117** holds `products` against writes from building its key to its end: that's also what stops stock moving while it's copied. First written with the links and second index in place from the start it took 32 s at this size, with sales told busy for all of it; copying first and adding them after took it to 1.7 s. Links are `NOT VALID`, as 115's: what's copied can only be each business's own, and every later row is checked.
- **118 rewrites every older line** (3,000,000 went to 698 MB, with the dead copies to be tidied by the database), because the piece says older lines get their shop and nothing else gives them one. It's on its own so it holds nothing but those lines. A server starting while it runs waits, and a second one waiting more than 30 s for the migration lock gives up, so past about 2 million lines a shop with two servers would see one restart. No real shop is near that: none is live.
- **Between 117 running and an older server stopping,** if one is still serving, its changes reach the total and not a shop's figure, and its lines say no shop. 2,000 such lines were written during the measuring, on purpose. Nothing corrects those but a count. No real shop is live; the test copy updates in about a minute. For the first real deployment that matters, stop the old server first.

**Query plans**, on the large tables, under row-level security: a product at each shop and many products at one shop use `idx_product_stock_product`, 0.1 ms or less; what moved at a shop uses `idx_stock_movements_shop_product`, 0.1 ms. All plain columns compared with `=`, so no leakproof question arises, and no expression index was added.

**Apply** through its real route, with an adjustment of one of those products tried throughout:

| Products changed | Before this piece (`stock-movements-say-who`) | Now | Meanwhile |
|---|---|---|---|
| 5,000 | 0.6 s | 0.7 s | waits, and goes through |
| 10,000 | 1.2 s | 1.4 s | waits, and goes through |
| 20,000 | 2.2 s | 2.8 s | told once to try again |
| 50,000 | 5.7 s | 7.0 s | told three times, for about 6 s |

Writing 50,000 shop figures is about 0.9 s of that. Jack's answer 6 accepted "about 6 seconds" at 50,000; this is that plus about a second. The "before" column was measured earlier, not side by side. The Citrus import costs one more statement per row with stock, in its existing batches; not measured again.

## 6. A count belongs to a shop

`stock_takes.site_id`, set when it's started; ones already running belong to the oldest. Not the shop Apply is pressed at: a count at Bolton applied from the office on a browser would otherwise land on the oldest. So `differencesOf` and `notCountedOf` read that shop's figure, what moved counts only if it moved at that shop, and Apply and Undo pass its shop to `moveStock`. Nothing on screen says which shop a count is for, as nothing is drawn and a one-shop business has no question; it comes with the switcher. "Below zero" still picks products by their total, section 4.

A count's `product_ids`, `Undo`'s "a later count has corrected this" and the 2-second limit are unchanged. The later-count check looks across shops: a later count at another shop stops an Undo here. Stricter than it needs to be, and safe.

## 7. A product's page

`GET /api/products/:id` gains `stockAtShops: [{ id, name, qty, here }]`, oldest first. No cost in it, so no `canSeeCosts` question; Staff see it (the 3 Oct later change to stock control decision 3). In stock lists each with its own Running low or Below zero tag, then "Low-stock level [n]", or "[n] each" with two or more, as `tr-sites` draws. One level for all shops: "[n] each" is what's drawn, and a level per shop isn't. Not built: "On its way" and the note under it, as nothing's on its way until sending is built. Adjust takes the row marked `here`.

## 8. The Citrus import's other-store rows: no change

A row for another store still reads "Stock at [Store]: one shop's stock comes across for now", and needs a look, and the shop can leave it out. The first store ever sent goes to the oldest shop.

`product_stock` removes the reason it couldn't come across: a product can now have a figure at a second shop. What's missing is everything else: Add a shop isn't built, so there's rarely a second shop to put it at; nothing says which Citrus store is which shop; and a row left out is what the shop decided, so nothing should bring it across by itself. What should change, when Add a shop is built, is a question for Jack, in the report on this piece. The wording "for now" stays true until then.

## 9. What's in nobody's way

No change to `till_sales`, the snapshot's shape, the sync's request or answer, or `sales`. Step C's sale writes through `moveStock` with its till's shop as the old sync does. The settings store and roles aren't touched: `siteHere` stays one place for WP-1.4 to add a session's chosen shop to, as `oldestSite` is for its fallback.
