## ADDED Requirements

### Requirement: A receipt's address can be saved as a new customer

With no customer on the sale, "Email the receipt" SHALL offer "Save to a
customer record", unticked. Ticked, once the receipt is sent, a quick "Add a
customer" SHALL open with the address filled in; "Add the customer" SHALL
save them with what was typed, and "Happy to hear about offers" only if
ticked; "Not now" SHALL keep the receipt sent and add no one.

#### Scenario: Saved
- **WHEN** Jo ticks Save to a customer record, sends to maya@example.test, types Maya Patel and presses Add the customer
- **THEN** Maya Patel is added with that email and no offers, and the till carries on

#### Scenario: Not now
- **WHEN** Jo ticks it, sends, then presses Not now
- **THEN** the receipt stays sent and no customer is added

#### Scenario: Unticked
- **WHEN** Jo sends without ticking it
- **THEN** no Add a customer opens and no one is added
