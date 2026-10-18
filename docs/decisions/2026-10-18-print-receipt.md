# Printing a receipt (18 Oct 2026)

Jack, 18 Oct, after paying a job's order at the till (#267). Receipts are
drawn and decided (`till-receipt`, `receiptBody` in `collect.mjs`,
`set-till-receipts`; 29 Sep decision 7 and 13, 2 Oct receipt email) but
almost none of it is built, and most of it (email, text, the print agent)
is server work in Mark's lane in stage 3 (WP-1.11, WP-3.1).

1. **Print only, through the browser, now** (Jack: "1: print only, through
   the browser, with the printed receipt drawn for me first"). The Paid box
   gains Print, and the diary menu gains Print receipt; both print the
   receipt on whatever printer the computer has. The printed receipt is
   drawn first for Jack's approval. Chosen over building Shop details first
   (about twice the work) and over leaving receipts for stage 3. Email,
   Text, the print agent and reprinting from past sales stay in their
   packages.
2. **No VAT line until VAT is recorded; "Sale [n]" until receipt numbers
   exist** (Jack: "1: leave the VAT line off for now and print just the
   Total; it appears once Mark's pence work records VAT on each sale.
   Receipts print 'Sale [n]' until real receipt numbers exist"). Today's
   sales keep neither their VAT nor a B1-style receipt number; both come
   with WP-1.6 (`openspec/changes/wp-1-6-sales-in-pence`). Chosen over
   working VAT out from each item's current rate, which a reprint could get
   wrong. This holds the 2 Oct decision's VAT line back until the data
   exists; it doesn't drop it.
3. **The drawings approved** (Jack: "Approve both drawings; go ahead and
   build printing"): `till-receipt-print`, the Paid box with Print and No
   receipt, and `till-receipt-paper`, the printed receipt. The diary menu's
   Print receipt is already drawn (`diary-menu-job`).
