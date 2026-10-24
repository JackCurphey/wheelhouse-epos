## ADDED Requirements

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
