# Spec Delta

## ADDED Requirements

### Requirement: The booking page's money is added up in pence
The booking page's Work agreed total SHALL be its lines summed in pence by the server, with each line's price read from its pence, and none when prices are hidden online. The quote card's Approve total SHALL add whole pence: what the customer agreed before and each ticked line's total, both as the server worked them out, divided by 100 only to show it.

#### Scenario: Work agreed
- **WHEN** Maya's agreed work is a £65.00 service, pads at £28.00 and fitting at £18.00
- **THEN** the Work agreed card's total reads £111.00

#### Scenario: Ticking a line
- **WHEN** Maya has £65.00 agreed and ticks pads at £28.00 and fitting at £18.00
- **THEN** the button reads "Approve £111.00"
