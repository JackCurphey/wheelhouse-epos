## ADDED Requirements

### Requirement: An online order takes its items off stock when it is paid
When an online order is paid, each item SHALL come off the collecting shop's stock and the business's total at once, recorded as a stock movement caused by that order's sale (question 9, waiting for Jack). The website's "Ready today at Bolton · [n] in stock" SHALL then count it out.

#### Scenario: The last one is bought online
- **WHEN** Maya pays for the only Shimano brake pads B05S-RX at Bolton
- **THEN** Bolton's stock of them is 0 and the website says "Sold out at Bolton"

### Requirement: A refunded item goes back on sale
When an online order, or one item of it, is cancelled or refunded as couldn't supply, its items SHALL go back onto the collecting shop's stock, recorded as a stock movement caused by that refund.

#### Scenario: Cancelled
- **WHEN** Maya's order for 2 brake pads is cancelled
- **THEN** Bolton's stock of them goes up by 2, with the order's refund as the cause

### Requirement: Stock still on the shelf for an online order is marked as such
Until an online order is handed over, the stock lookup the till uses SHALL say how many of a product at that shop are "for an online order", with the order number, so the till can warn without blocking.

#### Scenario: One kept for an order
- **WHEN** the till looks up Shimano brake pads B05S-RX at Bolton while Maya's paid order waits
- **THEN** the answer says one is for an online order, [order number]
