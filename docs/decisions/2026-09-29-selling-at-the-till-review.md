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
8. **The till takes all five other ways to pay** (Jack, 29 Sep): gift
   cards (sell, top up, spend), store credit, customer accounts (pay later),
   loyalty points (earn and spend), and deposits (part now, the rest
   later — ties to Workshop day decision 63, payment and collection as one
   step). Each opens from "Take payment", or from the customer in the
   basket for points.
9. **Refunds start from the original sale** (Jack, 29 Sep): find the sale
   (receipt number, customer, card or date), choose what comes back, and
   the money goes back the way it was paid — to a card through the
   connected card machine (decision 6). With no receipt or record, it's
   store credit only. Keeps stock and VAT right and stops cash going out
   for things not bought at the shop. Chosen over any-refund-with-a-reason
   and a manager PIN for every refund.
   (Also 29 Sep: Jack prefers to work through journeys one at a time in a
   single session, not in parallel sessions.)
10. **Two assumptions stand** (drawn 29 Sep, not objected to by Jack when
    he moved on to the audit): voiding a sale needs a reason but no manager
    PIN (in the spirit of decision 4), and paying for a workshop job also
    marks the bike collected by default, with a pill to switch it off
    (Workshop day decision 63 made concrete).
11. **Part-paying a workshop job starts from the payment** (Jack, 29 Sep):
    "Deposit" on Take payment switches "Bike collected when paid" off by
    itself and says the bike stays in with the rest paid at collection.
    When the customer comes back, the job loads with a "Deposit paid" line,
    only the balance to pay, and the collected pill on again — so paying
    the rest also records collection. Paying everything now but collecting
    later = switch the pill off before paying. Chosen over starting from
    the pill. (Jack also confirmed collected-when-paid as the default.)
12. **Audit fixes adopted** (Jack, 29 Sep; `docs/design/user-journeys/till-ui-audit.md`):
    safe choice on the left and the confirming action on the right in every
    pop-up (Remove moves into the pop-up's body); a "Past sales" button in
    the till bar opens Find, and each past sale offers Refund, Void and
    Reprint; the empty basket, search with no results, and refunding a cash
    sale are drawn; the routine offline notice turns warm grey, keeping the
    warning colour for the four-hour notice (amber means "you are here",
    Workshop day 48); the frame-number box gets a scan icon; the £/%
    switch remembers the last choice, starting with £; click and collect
    starts unticked; the gift card hint is shortened.
13. **Past sales opens on "Scan or type the receipt number", with today's
    sales on this till listed underneath; older sales are found through the
    customer's page** (Jack, 29 Sep). Receipts carry a barcode so a refund
    is usually one scan. No free search by date or card digits. (Jack worried
    a search over every sale would be slow; it wouldn't be — the database
    indexes sales — but the narrower, pointed design suits the till.) A
    walk-in with no receipt and no customer can't be found, so gets store
    credit (decision 9). Chosen over removing Past sales and keeping the
    free search.
14. **Journey 11 desktop approved with that change** (Jack, 29 Sep: "I
    think this looks really good"); tablet and phone next.
15. **"Other" at the bottom of Take payment opens a list of less-used ways
    to pay** (Jack, 29 Sep): finance, Cycle to Work schemes, payment links
    (once set up), and any others the shop adds — kept off the main
    pop-up so it stays uncluttered, but always one tap away. Opening it
    expands the list in place.
16. **Journey 11 approved** (Jack, 29 Sep: "let's get it into the big
    canvas") — desktop, tablet and phone. It is copied into the user
    journeys canvas, status Designed; journey A's till boards there are
    refreshed with the Past sales button.


**Later change (30 Sep, Customer service decision 10):** loyalty is store
credit earned by buying — no separate points. The basket's customer row now
reads "[£] store credit · Earned on past purchases · Use it" (board
`till-loyalty`, all sizes), republished here and on the big canvas.

**Later change (30 Sep 2026, Collect the bike and pay decision 5, audit
M2):** a workshop job's agreed lines are locked in the till basket — no
− / + — and marked "agreed on the job"; anything extra is added separately.
Affects the job, deposit and balance boards.

**Later change (30 Sep 2026, Receiving stock decision 5):** a bike's frame
number is now recorded when it's booked in, so "Record a frame number"
becomes "Which one?" — pick from the bikes in stock by frame number, or scan
the frame on the bike; "Skip for now" stays for stock that came in without
one.

**Later change (3 Oct 2026, third walk, answers 1 and 4, `docs/decisions/2026-10-03-ux-walkthrough-third-walk.md`):** Jack, 3 Oct: "1" to each. The till search's rows are drawn as decided (each row's name opens it, the till button sits on the right; a job row reads "Expected 11:30 · Book in" or "Paid online · [date] · Hand over"), and a Cycle to Work bike paid with only the certificate has its own paid box, "Paid · Cycle to Work · [Provider]". Decisions 7 and 12 are unchanged. Drawn in `docs/superpowers/specs/2026-10-03-draw-the-third-walk.md`.

**Later change (5 Oct 2026, issue #138):** Jack, 5 Oct: "can we build it so that we can connect differnet kind of payment machines to it? … i dont want this system to only work with paymentsense". Decision 6's card machine link goes through one card machine adapter that names no company: each make of card machine is its own connection behind it, with its own details. Paymentsense (an Ingenico Move/5000 on wifi, #138) is the first; typing the amount in on the machine stays as the fallback.

**Later change (5 Oct 2026, `docs/decisions/2026-10-05-card-payments-provider.md`):** Jack, 5 Oct: "1". The first card machine connection is Stripe (Stripe Terminal), the same company as online payment links; SumUp second; Paymentsense later. Typing the amount in stays the fallback.
