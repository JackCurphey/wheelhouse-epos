# Design

## 1. Who adds and changes a product (decision 11)

`server/lib/product-editor.js`, one place for WP-1.1 to replace with "Can order stock": the Owner's sign-in, and nobody else checked in by PIN on it. Refused: "Only the shop’s owner can add or change products", 403 `owner_only`. It guards adding a product, saving one (its price and cost included), taking it off or back on sale, its photo, its details, bringing a supplier's item in, and making or changing a product with sizes.

Not guarded, as decisions 5, 6 and receiving 4 say everyone may: adjusting and counting stock, and receiving a delivery.

- **Where staff saved a product until now:** only the old app (`public/app.js`): Stockroom's Add product and Edit, Deactivate and Activate, a product's photo, and Import from a supplier's catalogue. Each shows the server's words in its toast, so staff now see the refusal plainly and nothing is saved; a browser test covers Add product.
- **Receiving's drawn path (`rs-add-left`):** staff who scan a barcode Wheelhouse doesn't know leave it for someone who can add it. What's built today reads products only and says "Nothing in Wheelhouse has the barcode [code]", so it is unchanged; the Owner adds the product. The "left for" list itself and Add this product's screen aren't built yet (pieces 8 to 10).
- **The split plan's "a product's cost isn't edited until WP-1.5":** the server takes a cost from the Owner now, through the same `canSeeCosts` rule as before.

## 2. A product's details

`PUT /api/products/:id/details` with `answers: [{ detailId, value }]`, the Owner's, under the product's lock with the save's 2-second limit. A detail must be its category's or one above it; a number up to nine digits and four places; a choice one of its choices, saved as the choice is written; text up to 200 characters; an empty value takes the answer off. `GET /api/products/:id` gains `details`, top of the tree first, each with the category it comes from (`from`) and its answer.

## 3. Finding by a detail, under row-level security

Comparing `numeric` isn't leakproof, so an index on `value_number` can't be used ahead of a business's own rows (checked in `pg_proc`); comparing `bigint` is. Migration 121 keeps each number answer also as `value_key`, a whole number of ten-thousandths, held equal to it by a check, and indexes `(shop_id, detail_id, value_key)` and `(shop_id, detail_id, value_text)`.

- **Search** (`st-search-measure`; decision 10): a number with a unit, "30 mm" or "30mm", is a number detail with that unit (in any case) and that value; a number alone is found in a name or code, or any number detail. Every word must still be found.
- **Filters** (`st-filter-bearings`): `?category=[path]` takes the category and those inside it; `?d[detail id]=[value]` narrows to that answer.
- **Query plans,** with 1,000,000 products of another business beside 2,000, under the app role: products with 30 mm, `idx_product_details_detail_key`, 0.03 ms; the list's products, `idx_products_shop_category`, 1.5 ms; its products with sizes, now `idx_product_groups_shop` (new in 121), 0.03 ms, where before it read the `(id, shop_id)` key through every business's groups. The list's one order, 2.8 ms.

## 4. Making and changing a product with sizes (answers 5 and 9)

`POST /api/product-groups` and `PUT /api/product-groups/:id`, the Owner's.

- **Each size's own product** is named with the product's name, its size and its colour, "Jersey M Blue" ("Jersey M" or "Jersey Blue" with only one), with the product's category. A save rewrites every size's name and category in the same transaction, so a name typed for one size by hand goes the next time the product is saved (answer 9). A product's name is up to 60 characters, a size 20, a colour 30, so a size's name is at most 112, within everything that shows it (Shopify takes 255; the database's columns have no limit).
- **A sale's saved line** (`sale_items.name`) is the size's own name at the time of the sale, so a receipt and past sales say "Jersey M Blue". Tested at the longest a name can be.
- **Sizes:** one sent with its id is changed, one without is added (with starting stock through `moveStock`, naming who), one left out stays; `active: false` takes one off sale. Each size and colour once, in any case; a barcode or code another product has is refused, saying which.
- **Its category** is found or made from its path (`categoryFor`), as a product's is.
- **Locks, in the one order** (piece 5): its category first (`categoryFor`, `FOR KEY SHARE`), then its sizes in id order, then the product with sizes, each `FOR UPDATE`, under the 2-second limit, so it can't deadlock with a category rename (categories, then products, then products with sizes). A race test holds a size so the save stops between its category and its sizes, renames the category meanwhile, and both go through with the sizes on the new path; with the order reversed it was told busy.
- **The website:** after COMMIT, a size on the website is synced as a product's save does.

## 5. Not built, and noted

- Saving one size through `PUT /api/products/:id` can still give it a name or category other than its product's, until the product is next saved (answer 9 accepts this for the name).
- Matching a product's supplier to a supplier: the restock list's own piece (answer 10).
- The screens: pieces 8 to 10.
