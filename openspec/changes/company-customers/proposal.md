# Company customers

## Why

A shop sells to clubs and companies as well as people: a club buying for
its members, a business with a fleet of bikes. Jack asked for "is this a
company account" when a customer is made (customer service review,
`docs/decisions/2026-09-30-customer-service-review.md` decision 3), and for
a plain, generic VAT invoice for them (Jack, 2 Oct: "lets just have a
generic vat invoice for now";
`docs/decisions/2026-10-02-leftover-screens-review.md`, UI audit H2 and the
later change). The earlier note that the invoice "waits on the accountant"
(`decided-while-building.md`, customers list 5) is overruled: "No check,
build now" (`docs/decisions/2026-10-26-day-answers.md` section 3).

**Work package:** customers (WP-5 area), Jack's lane. **Risky area:** a
migration (087, columns on `customers`). It doesn't touch money, stock,
sign-in or public routes.

## What changes

- **Add a customer** gets "This is: A person / A company or club". For a
  company it asks for the company or club name, the contact name, and two
  optional boxes, "VAT number" and "Send invoices to" (drawn as
  `cs-add-company`, `docs/design/user-journeys/generator/customer.mjs`).
- **Edit** works the same way, on the customer's page (`cs-edit`).
- **The server** keeps and returns the four new details
  (`POST`/`PUT /api/customers`, `GET /api/customers/:id`).
- **The emailed receipt** for a company is headed "VAT invoice", with an
  "Invoice to" block from the company's record, a blank line left out
  (drawn in `collect.mjs`, `cp-receipt-email` with `invoice`).
- **The till's "Email the receipt"** fills in "Send invoices to" for a
  company, or the contact's email when that is blank (audit H2: "default to
  the contact's email"; the drawn email goes to "[accounts email]").

## Out of scope

- The printed receipt, the text receipt page and its PDF download: the
  brief is the emailed receipt.
- A VAT amount on the invoice: the emailed receipt has no VAT line until a
  sale records VAT (`openspec/specs/receipt-email`), and the old sales it
  reads never did.
- An invoice number series of its own: it is numbered as the receipt is.
- Showing the contact name, VAT number or "Send invoices to" anywhere but
  Edit, and finding a company by its contact's name: not drawn.
- Merging a company with another customer keeps the kept record's company
  details; the merge pop-up doesn't compare them.
