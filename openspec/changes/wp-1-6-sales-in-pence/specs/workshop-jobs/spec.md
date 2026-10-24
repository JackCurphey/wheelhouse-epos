# Spec Delta

## ADDED Requirements

### Requirement: Workshop amounts are kept in whole pence
A service's price, a quote line's unit amount and a booked service's price SHALL each be kept as a whole number of pence, the authority, with its pounds written in the same statement until nothing reads them. Every total the workshop works out (a quote line's total, a quote's totals, what was agreed before, the whole bill, the Proposed total, and the amounts in the quote's messages) SHALL be summed in pence by the server and given in pounds as pence over 100.

#### Scenario: A price in pence
- **WHEN** staff save a service at £65.00
- **THEN** it is kept as 6500 pence, and read back as £65.00

#### Scenario: Totals follow the pence
- **WHEN** a quote line's pence and pounds disagree
- **THEN** every total that counts the line uses its pence

### Requirement: A quote line's total is its quantity times its unit pence, rounded once
A quote line's total SHALL be its quantity times its unit amount in pence, rounded to a whole penny, worked out in one place on the server. A labour line's quantity MAY be part of an hour; a part line's quantity SHALL be a whole number, as its order line counts whole items, and any other SHALL be refused with "A part’s quantity must be a whole number."

#### Scenario: Half an hour of labour
- **WHEN** a labour line is 1.5 hours at £36.00
- **THEN** its total is £54.00

#### Scenario: Half a part
- **WHEN** staff quote 1.5 brake pads
- **THEN** the quote is refused with "A part’s quantity must be a whole number."

### Requirement: The job page's Proposed total comes from the server
The job page SHALL show a draft or sent quote's Proposed total as the server works it out, never adding pounds up itself: the job's order, any booked service not on it yet, and the quote's lines not on the order yet (waiting for an answer, or said yes to one at a time before the whole answer adds them). For a draft this SHALL equal the whole bill the spending limit is checked against.

#### Scenario: A draft
- **WHEN** Maya's £65.00 service isn't on the order yet and staff draft pads at £28.00 and fitting at £18.00
- **THEN** the job page shows "Proposed total £111.00"

#### Scenario: A line declined while the quote is sent
- **WHEN** Maya says no to the fitting on her phone and the pads still wait
- **THEN** the job page shows "Proposed total £93.00"
