# The overview's leftover screens — Jack's decisions (2 Oct 2026)

With every journey drawn, six screens from the original plan were still in
the overview's "not designed" box. Jack chose to design them in small groups
(2 Oct: "1"), except journey 13's three supplier screens, which wait for a
later release (see the later change at the end of
`2026-09-30-receiving-stock-review.md`). The rest:

- **Receipt or invoice by email** (journey 5, TILL-13 · DONE-04)
- **Till start-up** (journey 10, Offline spec §5)
- **Returning customers** (journey 17, REP-10)

Background, not reopened here: after a sale the till offers Print, Email,
Text or No receipt and closes by itself (Selling at the till 3); receipts
carry a barcode so a refund can find the sale (Selling at the till 13); the
customer's account shows past receipts with "Email me this receipt" (Account,
history and reminders 1); "Bike ready" links to one job's summary with no
sign-in (Collect the bike and pay; Owner setup 23). Real example data only:
North Street Cycles, Bolton, Till B1, Jo Taylor, Maya Patel
(maya@example.test), WH-1042 at £111.00; VAT figures, receipt numbers and
addresses are bracketed placeholders.

## Receipt or invoice by email

1. **One receipt email for every sale, which doubles as a VAT invoice when
   needed** (Jack, 2 Oct: "1."). Every till sale and collected repair sends
   the same email: the shop's details and VAT number, the receipt number and
   its barcode, each item, the VAT, the total and how it was paid, and "See
   it in your account". For a customer with a company name on their record
   the heading reads "VAT invoice" and adds their company details. Chosen
   over a plain receipt with VAT invoices on request, and a short email
   with the receipt only in the account.
2. **A text receipt is a short text with a link** (Jack, 2 Oct: "1"):
   "North Street Cycles: your receipt for £[total] — [link]". The link opens
   the same receipt as the email, with no sign-in needed, as "Bike ready"
   does; anyone with the link can see that receipt. Chosen over the whole
   receipt in the text, and taking "Text" off the till.
3. **With no customer on the sale, the address or number is for this
   receipt only** (Jack, 2 Oct: "1"). Staff type it; a tick, "Save to a
   customer record", starts unticked and, if ticked, opens a quick "Add
   customer" with it filled in. Nobody joins the customer list without
   agreeing. Chosen over always creating or finding a customer, and Email
   and Text only working with a customer on the sale.

## Till start-up

4. **The till's start-up status is one line on the PIN screen** (Jack, 2
   Oct: "1"): "Till B1 · Bolton · Online · up to date"; amber when
   something's wrong — "Offline · [n] sales waiting to send" or "Last
   updated [time]". No extra screen or step in the morning. Chosen over a
   separate start-up screen, and showing it only when something's wrong.

## Returning customers

5. **Returning customers: the numbers, plus a "not seen lately" list**
   (Jack, 2 Oct: "1"). A ready-made report beside the others (owners,
   managers, and staff with "Can see reports"): new and returning customers
   each month, the share who came back within 12 months, then the customers
   not seen for [n] months, each opening their customer page. It follows the
   Reports rules on who sees what, and suggests contact only for customers
   who said yes to messages. Chosen over just the numbers, and a "Returning"
   column in the Sales report.

## UI audit

6. **UI audit: every recommendation taken** (Jack, 2 Oct: "1"). From
   `design/user-journeys/leftover-ui-audit.md` (4 High, 11 Medium, 8 Low):
   - **The receipt email comes in two versions** (H1): with a customer, as
     drawn; with no customer, no account button, "Questions? Call [shop
     phone]", and "Keep this for returns. Show this email or give the
     receipt number."
   - **A company customer gets two optional boxes, "VAT number" and "Send
     invoices to"** (H2), which default to the contact's email; the invoice
     prints its "Invoice to" block from the record and leaves out a line
     that is blank. What a VAT invoice must carry, and whether it needs its
     own number series, is unchecked: Jack to ask the accountant.
   - **A till-sale receipt is drawn too** (M3): quantities, a discount, a
     split payment. VAT stays one "VAT at [rate]" row until the accountant
     says whether lines can have different rates.
   - **The PIN-screen line says what is up to date** (M4): "Online · prices
     and stock updated [time]"; amber when offline with sales waiting, or
     online but not updated for [n] minutes, or online with sales still
     sending. "Till B1 · Bolton" leaves the line (it's already in the bar).
   - **Returning customers** (M5, M7, M9): new and returning as two parts of
     one bar, so dashed still means "the period before" everywhere; "Last
     12 months / Last 24 months / Pick dates", the spend column following
     the period, a box to set the [n] months; a Message button on each
     customer happy to hear from the shop.
   - **The text receipt page stays as drawn, barcode included, and its link
     doesn't expire** (M10, the audit's option 1). Open: whether customers
     are expected to show their phone at the counter.
   - No choice needed: [n] for the invented "3 sales" (H4); a table of the
     monthly figures under the chart (H3); the till's next-sale countdown
     stops while the receipt pop-up is open, the cursor starts in the box
     and Enter sends (M1); the pop-up's missing states drawn (M2); phone
     month labels (M6); "Sales with no customer on them are not counted"
     (M8); "Email it to me" and "Download receipt (PDF)" drawn, the page
     taking the invoice version (M11); and L1–L8.

## Drawn

Drawn at desktop, tablet and phone on each journey's own canvas and copied
into the big canvas (2 Oct). Journey 5 gains a row, "The receipt": the
receipt email, the VAT invoice email, the text receipt and the till's "Email
the receipt" pop-up; its old "done-receipt" placeholder is gone. Journey B's
Till row gains the offline start-up screen; on it the till's top bar says
"Offline · [n] sales waiting to send" as well (on a phone the bar has room
only for "Offline"). Journey 17 gains Returning customers after the staff discounts
report, with a card on Reports home (so journey 20's Reports screens
change too); its "Still to design" row is gone, and so is journey 10's
start-up placeholder. No UI audit has been run on these screens yet. The
three screens still not designed are journey 13's supplier screens, left
for a later release.

After the UI audit (decision 6), 2 Oct: journey 5's receipt row grows to 12
screens (the email with no customer, a till sale, "Email it to me" on the
receipt page, and the pop-up's error, save, text, customer-on-sale and
offline states); journey B gains "online, but not up to date"; Returning
customers gains the monthly table, stacked bars and Message buttons;
journey 15's company form gains its two boxes. Two points are left for the
build rather than drawn: the email's barcode as a picture file (some email
programs don't show drawn ones, from memory), and the shared pop-up's ✕
being a link rather than a button — that is the same on every pop-up in
the app, so it's for the end-of-project audit, not this batch.

**Later change (Jack, 2 Oct: "lets just have a generic vat invoice for now,
im sure they all vary").** The VAT invoice stays the general one drawn: the
shop's details and VAT number, the company's "Invoice to" block from its
record, the lines, the total, one "VAT at [rate]" row and how it was paid,
numbered like the receipt. No accountant check before the design moves on;
what a particular shop or accountant needs is for later.
