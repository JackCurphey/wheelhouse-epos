# Design

## 1. Who adds and changes a product (decision 11)

`server/lib/product-editor.js`, one place for WP-1.1 to replace with "Can order stock": the Owner's sign-in, with the Owner the one there, the same people `canSeeCosts` tells. Refused: "Only the shop’s owner can add or change products", 403 `owner_only`; someone else checked in by PIN under the Owner's sign-in is refused the same. A till or workshop computer with nobody checked in could be anyone, so it asks for a PIN (409 `check_in_first`), as changing stock there does, with or without starting stock. The tests that pinned staff saving without a cost now expect the refusal. It guards adding a product, saving one (its price and cost included), taking it off or back on sale, its photo, its details, bringing a supplier's item in, and making or changing a product with sizes.

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

## 4a. From the review

- **A size's price in pounds** is taken as a product's save takes it: whole pence first, then pounds, within the same limit; on making, adding and saving.
- **Swapping two sizes' labels** (M and L) in one save works: every size whose size or colour changes is moved aside to a placeholder first, as the one-of-each index checks each row as it changes.
- **A size saved on its own** (`PUT /api/products/:id`) keeps its product with sizes' category: a different one is refused, "[Size's name] is a size of [Product]. Change the category on [Product], and every size follows." The same category, as the old app's form sends, goes through. Its name is answer 9's; nothing else on that route belongs to the product with sizes.
- **An empty till asks for a PIN** before a Citrus Lime file is sent, Fixed or Left out, a category is added or renamed, or a supplier is added or changed: a file brings products across with prices and costs, a category rename rewrites products' text, and a supplier's words sit beside costs. Fix and Leave it out already asked, through who is fixing; sending a file didn't. A supplier needs someone checked in, not the Owner, as before.
- **Searching "700c", "29er", "12v":** digits and letters are a measurement only where some detail has that unit; otherwise, and as well, they're found in a name.

## 5. Not built, and noted

- Saving one size through `PUT /api/products/:id` can still give it a name other than its product's until the product is next saved (answer 9).
- Matching a product's supplier to a supplier: the restock list's own piece (answer 10).
- The screens: pieces 8 to 10.
