# Design: company customers

## 1. The record (migration 087)

Four columns on `customers`, all additive:

- `is_company boolean NOT NULL DEFAULT false`
- `contact_name text`, `vat_number text`, `invoice_email text` (nullable)

A company's name is the customer's `name`. So the list, the header search,
the customer's page, the till and the diary show the company's name with
no change, as every other customer's name shows.

## 2. The server

`POST /api/customers` and `PUT /api/customers/:id` read `isCompany`,
`contactName`, `vatNumber` and `invoiceEmail`; every customer read returns
them (`serializeCustomer`).

- **Absent keeps what's there,** as the address and postcode do.
- **A company needs a contact name:** "Add the contact’s name." (400). It is
  the one field on the drawn company form not marked optional, beside the
  name.
- **"Send invoices to"** is checked as an email address when given: "That
  doesn’t look like an email address — check it" (400), the receipt's
  wording. Up to 254 characters.
- **VAT number:** free text, up to 30 characters; no format check, since
  this is a generic invoice for any shop.
- **A person has no company details:** saving one with `isCompany: false`
  clears the three.

## 3. The screens

- **Add a customer** (`cs-add`, `cs-add-company`): "This is" is a pill
  group (as Group). A company swaps "Name" for "Company or club name" and
  "Contact name", with the drawn placeholders, and adds "VAT number
  (optional)" and "Send invoices to (optional)" after the address, each
  with its drawn placeholder.
- **Edit** has the same, with Edit's labels (no "(optional)", as Edit's
  Address and Note).
- A missing company name says "Add the company or club’s name."

## 4. The VAT invoice email

`receiptEmail` reads the sale's customer. When the customer is a company:

- the first line and the subject say "VAT invoice" instead of "Your
  receipt";
- after the shop's details, an "Invoice to" block: the company's name and
  address (address and postcode joined), then "VAT number [n]"; a blank
  line is left out;
- the rest is the receipt as built: "Sale [n]", no VAT line.

## 5. The till

`EmailReceiptDialog` fills the box with the company's "Send invoices to",
or else the customer's email. Its note names the company in full ("From
[Company name]’s customer record."), not a first name.
