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
3. **A product's page: a summary on the left, one history on the right**
   (Jack, 1 Oct: "1"), the same shape as the customer page (Customer
   service decision 2). Left: photo, name and codes, price, cost, margin
   and VAT, measurements and specifications, stock at each site, with Edit
   and Adjust stock. Right: one history of everything that changed its
   stock, newest first — sold, used on a job, received, counted, adjusted —
   each with who and why. A bike's page lists its frame numbers first: in
   stock, or sold and to whom. Chosen over folding sections, and tabs.
   Boards: `st-product`, `st-product-bike`.
4. **Sizes and colours: one product, with a grid on its page** (Jack, 1
   Oct: "1"). The stock list keeps one row per product, with its total and
   "[n] sizes · [n] colours"; the product page shows sizes across and
   colours down, each cell its own stock (each size and colour keeps its
   own barcode, Release 2 rule 3). Scanning a barcode or searching "jersey
   M" opens that size and colour; the till sells it as one. Chosen over
   each size as its own product, and rows that open out. Board:
   `st-product-sizes`; `st-list` gains a product with sizes.
5. **A stock take is counted a section at a time, blind** (Jack, 1 Oct:
   "1"). A manager starts a count of the whole shop, a category or an area
   ("Wall 3"); staff join it, ideally on a phone; each scan adds one, or a
   number is typed; the expected number is not shown while counting. Sales
   carry on and are allowed for. When it's finished the manager sees the
   differences, over and under with their value, can ask for a line to be
   recounted, and applies the count, which records every change. Chosen
   over showing the expected number, and whole-shop counts with the shop
   closed. Boards: `tk-hub`, `tk-start`, `tk-count`, `tk-diff`,
   `tk-applied`.
6. **Anyone can adjust stock, with a reason** (Jack, 1 Oct: "1"). "Adjust
   stock" on a product takes the change (or the new count) and a reason
   from a short list — Damaged, Lost or stolen, Found, Used in the
   workshop, Returned to supplier, Other (with a note); every adjustment
   goes into the product's stock history with who made it. An adjustment
   worth more than an amount the owner sets (Settings › Stockroom) shows on
   the manager's Today with "Seen". Chosen over adjusting only with "Can
   order stock", and staff asking a manager to approve. Boards:
   `st-adjust`, `st-today-adjust`, `st-setting-adjust`.
