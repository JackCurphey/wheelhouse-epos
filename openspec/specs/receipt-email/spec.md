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
