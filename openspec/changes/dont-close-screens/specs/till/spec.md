## ADDED Requirements

### Requirement: With Don't close things by themselves on, Paid waits for Start next sale

For a cashier with Don't close things by themselves on, the Paid box SHALL
have no countdown. It SHALL offer Print and Start next sale (in No receipt's
place) with the line "The next sale waits until you press Start next sale."
(`till-receipt-wait`). Print SHALL print the receipt and leave the box open,
and only Start next sale SHALL start the next sale. With the switch off, Paid
is as before.

#### Scenario: Printing, then the next sale
- **WHEN** Jo, with the switch on, pays a sale by card and presses Print
- **THEN** the receipt prints and Paid stays until she presses Start next sale
