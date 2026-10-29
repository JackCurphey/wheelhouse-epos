# Spec Delta

## ADDED Requirements

### Requirement: The shop sets when a stock adjustment shows on Today
Settings SHALL have a Stockroom room whose Stockroom area has a Stock adjustments fold: "Show on Today when an adjustment is worth more than", "At cost · for owners and managers", an amount in pounds and pence, and "Every adjustment is in its product’s stock history, whatever its value." (stock control decision 6; `st-setting-adjust`). Its summary SHALL read "Show on Today over £[amount]", or "Not set yet" until it is set. Only the Owner SHALL change it, until roles. The amount SHALL be kept in whole pence, from £0.00 to £100,000.00, and two saves at once SHALL each be written whole.

#### Scenario: Setting the amount
- **WHEN** Jack Lewis types an amount in Stock adjustments and leaves the box
- **THEN** it is saved, the fold's summary shows it, and adjustments worth more than it from then on show on Today
