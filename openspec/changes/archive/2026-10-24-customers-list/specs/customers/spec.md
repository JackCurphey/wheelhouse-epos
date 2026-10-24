## ADDED Requirements

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
