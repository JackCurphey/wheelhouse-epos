# Journey 14, Stock take and stock control — Jack's decisions (1 Oct 2026)

Journey 14 is the rest of the Stockroom: the stock list and a product's
page, sizes and colours, bikes by frame number, price changes, stock across
sites and transfers, counting stock (a stock take), and correcting stock.
Background, not reopened here: stock never blocks a sale and every stock
record belongs to a site (Release 2 rule 3 and the foundations spec);
products sold below zero are flagged for checking (offline spec §5);
Settings › Stockroom exists (journey 13 decision 7); a product carries its
measurements and specifications, added when it is booked in (journey 13
decision 3), and Jack wants staff to search by them — "bearings with a
30 mm outside diameter" (Owner setup, Noted for later); each bike is known
by its frame number from booking in (journey 13 decision 5); the restock
list and low-stock levels (journey 13 decision 2). Real example data:
Shimano brake pads B05S-RX £28.00; the Trek Domane AL 3; every other
product, price, cost and stock level is a bracketed placeholder. Designed in
the Soft sand look on its own canvas
(https://claude.ai/artifact/7oZPudk8GGxqY9L1iXBvbV), desktop first, then
tablet and phone. Generator: `stock.mjs` + `build-stock.mjs --theme sand`.
Rules for every journey apply (Workshop day 45, 48, 50, 53, 57, 62, 65–67;
A2, A6 — as few clicks as possible).

1. **Journey 14 is next** (Jack, 1 Oct: "1"), chosen over Book a repair.
2. **Stock opens on a searchable list with filters** (Jack, 1 Oct: "1"):
   one search box finds products by name, barcode, supplier code or
   measurement ("bearing 30 mm" finds bearings with a 30 mm outside
   diameter — Owner setup, Noted for later); filter pills (All, Running
   low, Below zero, then categories); each row shows the product, stock,
   price and margin, and opens the product's page. Chosen over categories
   first, and search only. Boards: `st-list`, `st-search-measure`.
