## ADDED Requirements

### Requirement: An online order is a sale when it is paid, kept out of the till's takings
When an online order is paid, it SHALL be recorded as one sale, with the card part as online money and any store credit part as store credit, counted for VAT on the day the money came in (question 9, waiting for Jack). Like a Shopify order and a deposit paid online, it SHALL be kept out of every till's close and shown on the online line.

#### Scenario: Close the day
- **WHEN** the till closes the day after an online order was paid
- **THEN** the order's money is on the online line, not in the till's takings

### Requirement: The till hands over an online order with nothing to take
Once the till's Collect screen is built (WP-3.1), it SHALL open a ready online order as "Online order · [order number]" with each item and where to fetch it ("from [Shelf name]"), "Tick each item as you hand it over. Already paid online — nothing to take at the till.", Not now and Hand over. Hand over SHALL be the same step as on the staff order page.

#### Scenario: Handed over at the till
- **WHEN** Jo Taylor ticks each item and presses Hand over at the till
- **THEN** the order is Collected and no payment is taken

#### Scenario: An item was refunded
- **WHEN** one item was refunded as couldn't supply
- **THEN** the hand-over adds "One item couldn’t be supplied and was refunded — nothing to hand over for it."

### Requirement: The till warns when selling stock kept for an online order
Once the till's warning is built (WP-3.1, `till-held`), selling an item that is for an online order SHALL warn at the till but SHALL not block the sale.

#### Scenario: Sold anyway
- **WHEN** Jo sells the brake pads kept for Maya's order after the warning
- **THEN** the sale goes through and Maya's order says "Not on the shelf any more"
