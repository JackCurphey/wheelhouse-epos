# Design

## 1. The text is the link

`openspec/changes/wp-1-5-products/design.md` section 6 planned `products.category_id` beside the text. This keeps the text and adds no column: a product's `category` is always a category's whole path, "Drivetrain › Derailleurs", unique within the business, and `product_categories.path` holds the same.

Why: a new column would need filling on every product, rewriting the whole `products` table in the migration, holding every product against sales while it ran (piece 3's 118 rewrote 3,000,000 lines in 46 s). Two figures that must agree can also drift; one can't. Every old reader (the stock list, a category count, the till's snapshot, the storefront) keeps working unchanged. The cost: renaming or moving a category rewrites its products' text, which section 5 covers. Searching by a detail (piece 6) joins through the path, an `=` on a plain column, so row-level security allows its index.

## 2. Tidy text

Split on "›", each part trimmed, empty parts dropped, joined with " › " (`server/lib/categories.js`, `tidyCategory`; migration 119 does the same in SQL). Nothing left is "Uncategorised", which isn't a category: such a product has none. Letters keep their case, so "bearings" and "Bearings" stay two categories, as the shop wrote them; merging them would change products the shop decided, and isn't drawn. A new category's name can't repeat a sibling's in any case (section 5).

## 3. Writing a product's category

Every writer finds or makes the categories in its path, in its own transaction: adding a product, saving one, a supplier's item imported, and a Citrus Lime row (its "Department › Category"). Each category found is read `FOR KEY SHARE`, so a rename at the same moment either finishes first, and the writer makes the old path afresh, or waits for the writer. Two making the same path at once: the second finds the first's (`ON CONFLICT`). Adding a product and the supplier import now take the 2-second limit before this; saving one already had it, and the Citrus import keeps its batch's own wait.

## 4. The migration

Three tables with row-level security and links whose key includes the business (WP-1.4 spec §5): `product_categories` (`parent_id`, `name`, `path`), `category_details` (`kind` number, choice or text; `unit` for a number only, `choices` for a choice only), `product_details` (a product's answers, removed with their detail; nothing writes them until piece 6, which adds what searching by them needs). Keys for links are `(id, shop_id)`, as 117's. An index on `products (shop_id, category)` for a category's products.

The tree is built from each business's distinct text. Only untidy text is rewritten, on just those products.

| Size | 119 | A stock write meanwhile | Reads |
|---|---|---|---|
| 100,000 products, 400 categories, 1% untidy | 0.3 s | waits up to 0.3 s | no wait |
| 1,000,000 products, 2,000 categories, 1% untidy | 2.9 s | waits up to 2 s, told busy once | under 5 ms |

Most of it is building the index, which holds products against writes, not reads, until the end. Query plans on the large table under the app role: one category's products, and a subtree's, use `idx_products_shop_category`, 0.1 ms and 1.4 ms; counting each category's products reads every product once, 122 ms.

## 5. Settings › Stockroom › Categories' server

`GET /api/product-categories`: every category by path, with its parent, its products, its own details, and how many products answer each ("Saving removes [Detail] from [n] products"). Anyone signed in, as a product's form will need it. Inherited details are read up the tree from `parentId`, on the screen.

`POST`: a name and where it sits. `PUT /:id`: Save, as `st-category-edit` does it, its name, where it sits and its own details as a whole list. A detail sent with its id is kept, one without is added, one left out is removed with its answers. The Owner only, until "Can order stock" (roles, WP-1.1).

- **Names:** not empty, no "›", up to 60 characters; not a sibling's in any case (409, "There’s already a category called [name] in [parent]").
- **Details:** up to 50, a name once from the top of the tree to the bottom (above it, and anywhere inside it); a number needs a unit (up to 12 characters), a choice 1 to 50 choices (each up to 40, none twice); a detail's kind can't change ("Remove it and add it again").
- **Renaming or moving** rewrites the paths inside it and its products' text. It can't sit inside itself or one of its own. A count running on any category in it refuses: "[path] is being counted. Apply that count first." Updating the count's target instead was weighed: a count's target holds 60 characters and a path can be longer.
- **Locks:** the limit first, then every category of the business `FOR UPDATE` in id order (a business has tens), then the products in id order, as stock takes them. A product saved at the same moment holds its product then its category, the other order: one waits up to 2 seconds or the database breaks the tie, and it answers busy. Reply after COMMIT.

Renaming through the route, with an adjustment of one of its products tried throughout: 1,000 products 24 ms, 20,000 187 ms, 50,000 474 ms, never busy.

## 6. Not built

Deleting a category (not drawn); the screens (piece 8); a product's answers, Edit and searching by a detail (pieces 6 and 9). A detail removed from a parent while a child shows it is the parent's to remove. Moving a category leaves its products' answers to details it no longer inherits stored and unshown; piece 6 says what a product shows.

## 7. From piece 3's re-check

Design 5 of `stock-per-shop` said the planner "can't use" `(id, shop_id)` to read a whole business; it can, with no harm measured. Corrected there. Migration 117's comment says the same; 117 is merged and the migration check refuses any edit to a merged file ("Files on main are frozen"), so the file stays and the design is the correction.
