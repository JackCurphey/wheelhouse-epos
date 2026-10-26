# receipt-email Specification

## Purpose
TBD - created by archiving change receipt-email. Update Purpose after archive.

## Requirements

### Requirement: Email a sale's receipt to an address

Staff SHALL be able to send a sale's receipt to an email address, for that
receipt only. A badly formed address SHALL be refused with "That doesn’t look
like an email address — check it". The email SHALL carry the shop's name and
details, the sale's number and time, its lines and discounts, the total and how
it was paid, with no VAT line until the sale records VAT.

#### Scenario: sending a receipt
- **WHEN** staff send sale 41's receipt to maya@example.com
- **THEN** an email goes to that address with sale 41's lines, total and payment, and the customer's own saved address is unchanged

#### Scenario: an address that isn't one
- **WHEN** the address is "maya@example"
- **THEN** it is refused, saying "That doesn’t look like an email address — check it", and nothing is sent

#### Scenario: another shop's sale
- **WHEN** the sale belongs to another shop
- **THEN** it is not found and nothing is sent

### Requirement: A company's receipt is an invoice

When the sale's customer is a company or club, the emailed receipt SHALL be
headed "Invoice", in its subject too, and SHALL carry an "Invoice to"
block after the shop's details: the company's name and address, then "VAT
number" and the company's VAT number, leaving out a line that is blank.
The till's "Email the receipt" SHALL fill in the company's "Send invoices
to" address, or its email when that is blank.

#### Scenario: a company's sale
- **WHEN** staff email the receipt for a sale to [Company name], whose record has an address and VAT number [Company VAT number]
- **THEN** the email is headed "Invoice", with "Invoice to", [Company name] and its address, and "VAT number [Company VAT number]"

#### Scenario: no VAT number on record
- **WHEN** the company has no VAT number
- **THEN** the "Invoice to" block has no VAT number line

#### Scenario: a person's sale
- **WHEN** the sale's customer is a person, or there is no customer
- **THEN** the email is headed "Your receipt", with no "Invoice to" block, as before
