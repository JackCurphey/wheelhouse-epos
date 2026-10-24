# customers Specification

## Purpose
TBD - created by archiving change customers-list. Update Purpose after archive.

## Requirements

### Requirement: Recent customers

Customers SHALL list the shop's most recently seen customers (added, changed,
or with a job or a sale), each with their latest bike and phone, opening their
page, and point to the header search for anyone else.

#### Scenario: someone just booked
- **WHEN** a customer has a job made today
- **THEN** they are near the top of Recent customers

### Requirement: Add a customer, catching a match

Add a customer SHALL need a name and a phone number or an email, and SHALL
show, while typing, an existing customer with the same phone number or email,
with a way to use them instead. Address, postcode, group and note SHALL be
optional, and Happy to hear about offers SHALL start off.

#### Scenario: a match
- **WHEN** the phone typed is Maya Patel's
- **THEN** "Maya Patel already has this number" shows, with Use Maya Patel

#### Scenario: no way to reach them
- **WHEN** neither a phone nor an email is given
- **THEN** it says "A phone number or an email — at least one." and nothing is added

### Requirement: A customer's page with one history

A customer's page SHALL show their details, their bikes, whether they're happy
to hear about offers, and one history of their jobs, sales and messages: jobs
still under way first (a finished bike waiting to be collected included), then
everything else, newest first, filtered by Everything, Jobs, Sales or Messages.

#### Scenario: an open job and an old sale
- **WHEN** Maya has a job booked in and a sale from last month
- **THEN** the job is under "Open now" and the sale under "Earlier, newest first"

#### Scenario: someone new
- **WHEN** a customer has no jobs, sales or messages
- **THEN** History says "Nothing yet" with New job

### Requirement: Edit a customer's details

Edit SHALL change nothing until Save changes, and SHALL keep the rules of Add
a customer: a name, and a phone number or an email.

#### Scenario: saved
- **WHEN** staff change Maya's postcode and press Save changes
- **THEN** her page shows the new postcode
