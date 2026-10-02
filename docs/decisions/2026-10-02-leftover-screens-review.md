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
