# Spec Delta

## ADDED Requirements

### Requirement: The shop sets its float
Settings › Front desk › End of day SHALL have a Float fold: "Leave this much in the drawer each night", in pounds and pence, and "Close the day works out the rest to bank, so every day starts with the same float." (cash-up decision 4; `set-eod`). Only the Owner SHALL change it, until roles. The float SHALL be kept in whole pence, from £0.00 to £100,000.00; until it is set the fold says it isn't set yet and there is no float check.

#### Scenario: Setting the float
- **WHEN** Jack Lewis types a float and saves
- **THEN** the fold shows it, and the next morning's float check asks for that amount
