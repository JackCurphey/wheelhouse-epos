# Journey 11, Selling at the till — Jack's decisions (29 Sep 2026)

Journey 11 is the till: ringing up a sale, taking payment, the other till
jobs (park, void, refund, find a past sale, pay for a workshop job, click and
collect) and what happens when the internet drops. It is designed in the
Soft sand look on its own Design canvas, desktop first, inside the frame
journey A settled: the folded rail on the Till page (A4, A5), the till bar
with "Serving: …" (A13), one search box that finds products, customers and
jobs (A12), and the basket on the right. Journey B settled check-in by PIN
alone (B4), working offline (B3). Rules for every journey apply (Workshop
day 45, 48, 50, 53, 57, 62, 65–67; A2, A6 — as few clicks as possible).

Background: the Release 2 spec (`docs/superpowers/specs/2026-09-27-release-2-design.md`)
puts the till in piece 3 — sales, refunds, voids, cash-up, VAT, card
terminal, receipt printer, offline selling. Wheelhouse has two payment
versions (full till, or Lightspeed-connected); the till designed here is the
full one, with one "Take payment" step that leaves room for the other.

1. **Journey 11 is next** (Jack, 29 Sep), chosen over Opening the shop,
   Owner setup, and Collect the bike and pay.
2. **The till's left side shows quick buttons the shop arranges, grouped
   under pills** (Jack, 29 Sep): e.g. Workshop, Parts, Accessories; one tap
   adds an item to the basket. The shop sets the buttons up (Owner setup,
   journey 8). Search and scan sit above them (A12). Chosen over browsing
   stock categories and search-only with recent items.
3. **Tapping a basket line opens a small pop-up in the middle** (Jack,
   29 Sep): the line's price, a discount (amount or percent, with a
   reason), a note (e.g. a serial number), and Remove. Quantity stays one
   tap on the line's − and + without opening anything. Follows the
   pop-ups-in-the-middle rule (Workshop day 15, 16). Chosen over expanding
   the line in place and a price-only edit.
4. **Anyone can give any discount; the reason is recorded and managers see
   every discount in the reports** (Jack, 29 Sep) — no manager PIN and no
   limit. Chosen over a shop-set limit with a manager PIN above it, and
   manager-only discounts.
5. **Selling something stock says is out of stock is allowed, with a
   warning on the basket line — "Stock says 0 — sold anyway"** (Jack,
   29 Sep): the item is in the customer's hand, so the sale is never
   blocked; the warning flags the count for checking. Chosen over allowing
   it silently and blocking it until a manager fixes the stock.
6. **The card machine is connected to the till** (Jack, 29 Sep): choosing
   Card sends the amount to the card machine by itself; staff no longer key
   it in. The till shows the card machine's progress (waiting for the
   card, approved, declined). This changes the Release 2 offline spec's
   assumption (`docs/superpowers/specs/2026-09-27-release-2-foundations-offline-design.md`,
   "standalone Paymentsense: staff type the amount in") — that is how the
   shop works today, not the target. Still to check before building: which
   card machine and provider can take amounts from the till, and what
   happens when the internet is down (most card machines need their own
   connection to approve). The design keeps a fallback — "Key it in on the
   card machine instead" — for when the machine isn't answering.
7. **After payment, a small "Paid" pop-up offers Print, Email, Text and No
   receipt, and closes by itself after a few seconds** (Jack, 29 Sep): the
   customer's email or phone is filled in when they're on the sale; doing
   nothing starts the next sale. Chosen over always printing and never
   printing unless asked.
