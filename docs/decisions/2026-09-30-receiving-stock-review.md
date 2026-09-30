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
