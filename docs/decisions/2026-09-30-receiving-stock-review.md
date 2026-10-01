# Journey 13, Receiving stock and purchase orders — Jack's decisions (30 Sep 2026)

Journey 13 is how stock gets into the shop: finding it in supplier
catalogues, ordering it, receiving deliveries (including part deliveries
and bikes with frame numbers), checking the supplier's invoice and printing
labels. Background, not reopened here: Release 2 piece 5 (Madison,
ZyroFisher and Raleigh feeds; purchase orders; receiving stock in — confirmed
feeds: Madison, ZyroFisher, Accell/Raleigh); labels and serial numbers
belong to piece 2; stock never blocks a sale and every stock record belongs
to a site (Release 2 rules 3 and foundations spec); "Can order stock" is one
of the permission switches (Owner setup 9); a job line can be "On order"
(Workshop day, waiting for parts); and Jack's note (Owner setup, Noted for
later) that parts should carry their measurements and specifications —
"bearings with a 30 mm outside diameter" — so staff can search by them.
Real example data: Shimano brake pads B05S-RX £28.00 on job WH-1042 (Maya
Patel); every other product, supplier, cost and stock level is a bracketed
placeholder. Designed in the Soft sand look on its own canvas
(https://claude.ai/artifact/RsbUcYNz9QfEF8LAbxSKwo), desktop first, then
tablet and phone. Generator: `receiving.mjs` + `build-receiving.mjs --theme sand`. Rules for every journey apply (Workshop day
45, 48, 50, 53, 57, 62, 65–67; A2, A6 — as few clicks as possible).

1. **Journey 13 is next** (Jack, 30 Sep), chosen over Book a repair, and
   Drop off and approve the quote.
2. **Orders are built by hand for now; ordering on the supplier's website
   and only receiving in Wheelhouse stays fully supported** (Jack, 30 Sep:
   "currently we do it like you have it in #3, and I know some shops will
   only ever do it like that … I think we should go with 2 for now"). A
   purchase order is opened, a supplier chosen and lines added; shops that
   order on supplier websites skip orders and just receive deliveries.
   Plus, from Jack:
   - **A part a job is waiting for gets flagged when it's booked in**: when
     a delivery includes a part on a job marked "On order" (Workshop day,
     waiting for parts), receiving it flags that job.
   - **A restock list**: in the Stockroom (and, for managers, on Today),
     what's running low or has sold a lot recently — e.g. "we sold 5
     Shimano chains and 10 pairs of brake pads" — which can be downloaded
     as a CSV to upload to a supplier's website basket (Jack: "I don't
     think it would be possible to add the stuff directly from
     Wheelhouse"). Which file format each supplier's basket accepts is
     still to be checked; drawn as a placeholder.
   Chosen over one self-filling draft per supplier, and receiving only.

**Noted for later (Jack, 30 Sep):** supplier integrations — for example
showing Madison's own website orders as a feed in Wheelhouse and creating a
purchase order from one, so orders placed on the supplier's site are known
without retyping.
3. **Deliveries are scanned in** (Jack, 30 Sep): "Receive a delivery",
   pick the supplier if you like, scan each item as it comes out of the box
   (each scan adds one; a quantity can be typed); an unknown barcode opens
   "Add this product", where its measurements and specifications are filled
   in (Owner setup, Noted for later); if there's an order for that supplier
   the list shows what's still to come; "Book in" adds the stock, flags any
   job waiting for one of these parts and offers labels. Items without a
   barcode are found by typing. Chosen over typing it in from the delivery
   note, and uploading the supplier's file.

**Noted for later (Jack, 30 Sep: "I would definitely like 3 in the
future"):** upload the supplier's delivery or invoice file to book a whole
delivery in at once — once each supplier's file format is known, alongside
the supplier integrations above.
4. **Everyone can receive deliveries; ordering needs "Can order stock"**
   (Jack, 30 Sep): Staff see Stockroom › Deliveries and orders with
   "Receive a delivery" and recent deliveries; orders and the restock list
   show only to owners, managers and anyone with the "Can order stock"
   switch (Owner setup 9). Chosen over receiving only with "Can order
   stock", and everyone seeing everything.
5. **A bike's frame number is recorded when it's booked in** (Jack, 30
   Sep): scanning a bike in a delivery asks for its frame number (scan the
   sticker on the frame, or type it) before it counts, so every bike in
   stock is known individually; the till then picks which one is being sold
   instead of typing it (a knock-on for Selling at the till's "Record a
   frame number"). Chosen over only at the sale, and either.
6. **A quick invoice check, which the shop can switch off** (Jack, 30 Sep:
   "1 but have it be an option in settings to turn on or off"): on a
   booked-in delivery, "Add the invoice" takes the invoice number and its
   total before VAT (the PDF can be attached); Wheelhouse compares it with
   the cost of what was booked in. If they match the delivery is marked
   "Invoice checked"; if not it shows the difference ("Invoice £[x] ·
   booked in £[y] · £[z] more") to query with the supplier, or accept.
   Deliveries waiting for their invoice are tagged in Recent deliveries.
   Shown to the people who can order stock. A settings switch turns the
   whole check off for shops that check invoices in their accounts software.
   Compares totals only, so it doesn't say which line differs — that comes
   with the supplier-file upload (Noted for later, decision 3). Chosen over
   line by line, and leaving it to the accounts software.
7. **Settings has four pages, one per room** (Jack, 30 Sep: "I think there
   should be 4 main settings pages, which correspond to each of the rooms,
   so front desk, workshop, stockroom, office"): Front desk holds Till,
   Payments, Messages and End of day; Workshop is as before; Stockroom is
   new and holds the supplier invoice switch (decision 6); Office holds
   Shop and sites, Staff and roles, and Your data. A room with several
   areas shows them as headings, each with its folding sections, and a
   "Jump to" row of pills; a phone opens Settings on the list of four
   rooms. Chosen over a short list of sections per room (one more click)
   and tabs across each room (hard to fit on a phone). Replaces Owner
   setup decision 3's eight areas. Board: `rs-invoice-setting`; every
   Settings board is redrawn.
8. **Labels only for what needs one** (Jack, 30 Sep): after "Book in",
   "Print labels" lists what was booked in; products without their own
   barcode, and new products added in this delivery, start at one label
   per item received; items with the maker's barcode start at 0; any count
   can be changed, and the label printer picked. Chosen over a label for
   every item, and no labels at booking in. Board: `rs-labels`.
9. **A delivery that isn't right is marked at booking in** (Jack, 30 Sep):
   each scanned line has "Problem?" — Damaged, Wrong item or Missing, how
   many, and an optional note. Damaged and wrong items aren't added to
   stock and go on "To return to [Supplier]" in Deliveries and orders (for
   people who can order stock), each with a "Returned" button; missing
   items stay "to come" on the order. Chosen over simply not booking them
   in, and a full returns process with return numbers and credit notes.
   Board: `rs-problem`; `rs-hub` gains the To return list.
10. **UI audit: every recommendation taken** (Jack, 1 Oct: "1"). From
    `design/user-journeys/receiving-ui-audit.md`: "Part arrived" also on the
    job's diary block and Overview row (drawn as journey 13 boards
    `rs-diary-arrived` and `rs-overview-arrived`; journey 12's approved
    boards keep their story); a count can be typed between − and +; the
    invoice's Checked, Queried and Accepted (one click, Undo) states; items
    set aside as problems listed on the delivery and named in a difference;
    the hub reordered (To return second, only when something's on it) with
    an empty Orders state; orders open, and a part-delivered order can be
    received against or closed; Book in stops while an unknown barcode is on
    the list; a frame sticker counts itself and a frame number already in
    stock is caught; "Waiting for invoice" in grey and "Partly delivered";
    the restock list grouped by supplier with a download each; suppliers as
    pills and the label printer the one used last; measurement names
    suggested from those used before; Today's restock line counts what's new
    and clears when opened or downloaded, for owners, managers and anyone
    who can order stock; Staff see a delivery without costs or the invoice;
    actions drawn as links are buttons, repeated ones name their row; the
    booked-in board's next steps; and Settings' Jump to pills are links and
    fold titles headings (shared frame — on-screen renders unchanged).
11. **Tablet and phone drawn** (Jack, 1 Oct: "lets draw the tablet and
    phone"): all 27 boards at three sizes, the same recipes. On a phone the
    restock list shows stock and sales under each product with its count
    beneath; the diary and Overview "Part arrived" boards use journey 12's
    own tablet and phone diary and Overview, with the badge on the job's
    block and row.

**Later change (1 Oct 2026, Stock take and stock control decision 6):**
Settings › Stockroom gains a second section, "Stock adjustments" (show an
adjustment on Today when it is worth more than £[amount]); the
`rs-invoice-setting` boards show it folded under "Supplier invoices".

**Later change (1 Oct 2026, Stock take and stock control decision 10):**
"Add this product" no longer has free-typed measurements with suggested
names (decision 3; audit M9). Picking the product's category brings up that
category's own details, set in Settings › Stockroom › Categories — for a
bearing, inner diameter, outer diameter and height. Settings › Stockroom
gains a "Categories" section, so the `rs-invoice-setting` boards show it
folded too.
