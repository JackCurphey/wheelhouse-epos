## ADDED Requirements

### Requirement: The Paid box can email the receipt

The Paid box SHALL offer Email between Print and No receipt (or Start next
sale). Email SHALL open "Email the receipt", which sends the sale's receipt
to the address typed. For a workshop job's customer, the address SHALL be
filled from their record and used for this receipt only. The next-sale
countdown SHALL stop while it's open. Once it's sent, the next sale SHALL
start, unless "Don't close things by themselves" is on, when Paid SHALL stay
open and say it was sent.

#### Scenario: A shop sale with no customer
- **WHEN** Jo takes £18.00 by card, presses Email and sends to maya@example.test
- **THEN** the receipt goes to that address and the next sale starts

#### Scenario: A workshop job's customer
- **WHEN** Jo pays Maya's job and presses Email
- **THEN** the box already holds Maya's address from her record

#### Scenario: The countdown waits
- **WHEN** the Email pop-up is open for longer than five seconds
- **THEN** the next sale doesn't start, and Paid says "Next sale waits until the receipt is sent"

#### Scenario: A bad address
- **WHEN** Jo sends to "maya@"
- **THEN** it says "That doesn't look like an email address — check it" and nothing is sent
