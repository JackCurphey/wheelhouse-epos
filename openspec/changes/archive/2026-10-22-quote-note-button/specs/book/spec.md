## ADDED Requirements

### Requirement: The quote and the agreed work lead to a note for the shop
While the bike is in the shop, the customer's quote card SHALL end "Not sure? Call [shop phone], or" with an "Add a note for the shop" button, and the Work agreed card SHALL end with the same button (dq-quote, dq-in-shop). The button SHALL move the customer to the Notes with the shop card and put the cursor in its box. Where the page has no notes card, the quote card SHALL offer the phone only.

#### Scenario: Not sure about the quote
- **WHEN** Maya, looking at her quote, taps "Add a note for the shop"
- **THEN** the page moves to Notes with the shop and the cursor is in its box, ready to type

#### Scenario: Before the bike is in
- **WHEN** the page has no Notes with the shop card
- **THEN** the quote card says "Not sure? Call [shop phone]." with no note button
