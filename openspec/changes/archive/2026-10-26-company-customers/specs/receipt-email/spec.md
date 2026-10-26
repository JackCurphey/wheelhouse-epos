## ADDED Requirements

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
