# Spec Delta

## ADDED Requirements

### Requirement: The payment provider needing more details goes to Needs attention

For the Owner, while the payment provider needs more details, Needs attention SHALL show "[payment provider] needs more details by [date]", "Or online payments and "Pay now" for repairs stop · usually [what they need]", and Add the details, which opens the provider's page. It SHALL leave the list once the provider no longer needs them.

#### Scenario: More details needed

- **WHEN** [payment provider] needs more details from the shop by [date]
- **THEN** Needs attention shows "[payment provider] needs more details by [date]" with Add the details

#### Scenario: Details added

- **WHEN** the provider no longer needs more details
- **THEN** the item leaves Needs attention
