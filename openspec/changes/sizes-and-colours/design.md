# Design

## 1. What sits underneath (Jack's answer 5)

`product_groups`: the one product people see, its name, category (a category's whole path, as `category-tree` keeps a product's), description and photo. `products` gains `group_id`, `size` and `colour`: a size and colour is a row in `products`, with its own barcode, code, price, cost and stock. A product with no sizes has no group, exactly as today.

Because each size stays a product, every sold, ordered, received and counted line points at it unchanged: the old till, `sales`, `till_sales`, orders, deliveries, stock take, Shopify and the till's snapshot read it as they do any product, and `moveStock` is the only thing that changes its stock. The old stock list (`/api/products`) and the old till's search show each size separately until they're retired (answer 5). `/api/products` now says a row's `groupId`, `size` and `colour`; nothing reads them yet.

Nothing in this piece makes a group. Making and editing groups and their sizes is product-editing (piece 6); linking the Citrus per-code products is piece 7. Tests make groups directly, as piece 6 will.

## 2. The rules the database holds

- In a group, a size or a colour (or both); out of one, neither. Neither is blank.
- Each size and colour once in a group, whatever its case ("M" and "m" are one).
- A group's link includes the business, with an `(id, shop_id)` key, as 117's and 119's. A group with sizes in it can't be deleted.
- Row-level security on `product_groups`.

## 3. The new stock list's server (`GET /api/stock-list`)

One row per group: its name and category, how many sizes and colours, its total stock, how many sizes are below zero and how many running low, and its lowest and highest price (and cost, for someone who can see costs). How a range of prices reads on screen is piece 9's: the server gives the two figures and no words. One row per product with no group, as now. Taken off sale left out unless `?all=1`, as `/api/products`.

**Search** (decision 4: "scanning a barcode or searching 'jersey M' opens that size and colour"; `st-search-size`). Every word must be found. A word is found in a name, code, barcode or supplier, or is a size's or colour's whole name, in any case: "L" is size L, not the "l" in "[Blue]". Then:

- a whole barcode or code is that size;
- a size or colour named is that size in each colour it comes in, each its own row ("jersey M": M in red and M in blue; "M [blue] jersey": the one);
- otherwise a group found by its name is the group's one row.

A size's row is named by its group, with its own size, colour, barcode, stock and price, as `st-search-size` draws it.

At 100,000 products, half of them sizes in groups of ten: the list in 541 ms, a search in about 420 ms; today's `/api/products` takes 865 ms on the same data. Like that list it reads the business's products once and works them out in the server; nothing here needs a new index.

## 4. A group's page (`GET /api/product-groups/:id`)

The group, its sizes and colours in the order they were made (for the grid's columns and rows; sizes have no order of their own), and each size and colour with its own barcode, code, stock and price, and cost for someone who can see costs (`st-product-sizes`). Its history and stock at each shop are the product page's, piece 10.

Migration 120 at 1,000,000 products: 85 ms. Adding the columns holds products for that long, reads included; a stock write waited 76 ms and none was told busy. Its new columns are empty and their checks `NOT VALID`, so nothing is rewritten; its one index covers only grouped rows, of which there are none.

## 5. A size on a count's line (stock take's "sizes and colours on a line")

Each size is counted as the product it is; only its name and line change. Wherever a count lists a product (the counting page's search, a counter's own lines, what's still to find, a recount asked, the check's differences and what nobody counted, an applied count's results), a size is named by its group and says its size and colour. The screens show "Size M · [Colour 1]" in place of its code, as `tk-count-below` and `tk-diff` draw it, beside "was below zero" where that applies; a colour alone reads "[Colour 2]", a size alone "Size L". Download the count gains Size and Colour columns after Product.

The counting page's search finds a size by its group's name too. It doesn't take "jersey M" as the stock list does: scanning, the drawn way to count, finds a size by its own barcode.

## 6. Not built, and for later pieces

- **A size row's own name.** `products.name` is what the old till and old stock list show for each size. Whoever makes sizes (piece 6, piece 7) writes it; including the size and colour in it ("[Product with sizes] M [Colour 1]") would let the old screens tell sizes apart. Noted for piece 6.
- The screens (pieces 9 and 10); "+ Add a size or colour" (piece 6).
