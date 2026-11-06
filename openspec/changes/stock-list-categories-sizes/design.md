# Design

## 1. The server's additions (risky: money and stock)

`GET /api/stock-list` (piece 5) is unchanged in what it finds and in who sees a cost. It adds:

- `vatRateBp` on every row: a product's or size's own rate; a product with sizes' rate when every size shares it, otherwise `null` (the screen shows no margin then). The screen's margin is the product page's: price before VAT less cost, over price before VAT.
- `details` on each product and size row, `{ [detailId]: value }` with a number as a number and a choice or text as written, **only** when a category is picked (`category=`) or the search holds a measurement. Read for just the rows sent, in one query on `product_details (shop_id, product_id)`; a product with sizes' rows carry none (each size answers for itself, on its page, piece 10).

Why only then: the plain list can be every product the business has, and nothing on it shows a detail.

## 2. Rows

- **A product:** as before: its code, category and supplier under its name; stock and its state; price; margin for the Owner.
- **A product with sizes** (`kind: 'group'`): "[Category] · [n] sizes · [n] colours", then "· [n] size(s) below zero" and "· [n] size(s) running low" when there are any; its stock the total, with no tag (the line says which). Its price "£[low]" or "£[low]–£[high]". Its margin only when every size has one price, one cost and one VAT rate; otherwise "—". It isn't a link until its page exists (piece 10). Running low keeps it when a size is running low, Below zero when a size is below zero.
- **A size found by a search** (`kind: 'size'`): its product's name, then "Size M · [Colour] · [barcode]"; it opens that size's own page, as each size is a product.
- Sorting: a product with sizes by its name, total stock, lowest price and margin.

## 3. The Category pill (audit M11)

After All, Running low and Below zero: a pill-sized search box labelled "Category", a combobox listing up to 8 category paths containing what's typed, from `GET /api/product-categories`; arrow keys and Enter, or a click, pick. Picked, it's a dark pill naming the path, with ✕ "Remove the [path] filter", which clears it and puts focus back in the box. While a category is picked, All isn't pressed; Running low and Below zero still narrow it; All clears the category too.

## 4. A category's details (decision 10; audit M12)

Its details are its own and those passed down, top of the tree first (from the categories list).

- **Filters**: a group "[Category] details:"; a number detail is a box with placeholder "Any" and its unit after; a choice is radio pills Any and its choices; a text detail is a box with placeholder "Any". Each sends `d[id]=value` once typing settles (300 ms, as the search box); Any or empty sends nothing.
- **Columns**: on a computer, each detail a column after Product, "30 mm", a choice or text as written, "—" for none; the line under the name drops the category (code · supplier); Margin goes to make room. On a phone, no detail cells, as drawn.
- **Summary**: "[n] in [Category]", then " with [Detail] [value] [unit]" for each filter set, joined with " and ". The drawing's "2 bearings with an outer diameter of 30 mm" needs a shop's own names made singular and lower case, which can't be done safely (piece 8's note did the same).

## 5. A measurement searched (st-search-measure)

When the search holds a measurement, a row with number answers shows them on its line instead of code · category · supplier: "Inner diameter [n] · **Outer diameter 30** · Height [n] mm", the unit once at the end when all share it, otherwise after each; the answer equal to the number searched in bold. The summary stays "[n] products": "2 bearings with 30 mm" would need the same guessing.

## 6. Keyboard and phone

Every control is a native button, input or radio pill; the category list is the stock take's (`useActiveOption`). On a phone the pills scroll sideways inside their row, the details filters wrap, and nothing else scrolls sideways at 375 px.
