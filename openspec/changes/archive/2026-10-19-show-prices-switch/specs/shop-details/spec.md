## ADDED Requirements

### Requirement: The shop chooses whether the booking page shows prices
Settings › Workshop › Online booking SHALL have "Show prices on the booking page", On or Off, saved as soon as it's switched (`bk-settings`; Jack, 19 Oct).

#### Scenario: Hiding prices
- **WHEN** the owner switches Show prices on the booking page off
- **THEN** it saves, and the online booking page lists services without prices
