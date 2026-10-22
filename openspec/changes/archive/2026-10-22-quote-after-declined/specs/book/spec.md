## ADDED Requirements

### Requirement: A newer quote keeps the customer's earlier answers as history
When the shop sends a quote after the customer has answered an earlier one, the customer's quote SHALL say "The quote has changed", that the earlier answers are kept, what was already agreed and what they said no thanks to, and ask only about the new lines (Jack, 22 Oct; dq-quote-newer).

#### Scenario: Pads after all
- **WHEN** Maya said no to the pads and the cable, then rings back, and the shop sends a new quote with just the pads
- **THEN** her page says "The quote has changed", "You said no thanks: Shimano brake pads, Replace gear cable", and asks only about the pads
