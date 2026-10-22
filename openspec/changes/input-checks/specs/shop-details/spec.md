## MODIFIED Requirements

### Requirement: The shop chooses whether the booking page shows prices
Settings › Workshop › Online booking SHALL have "Show prices on the booking page", On or Off, saved as soon as it's switched (`bk-settings`; Jack, 19 Oct). The server SHALL take only a real true or false for it; anything else SHALL be refused and change nothing.

#### Scenario: Hiding prices
- **WHEN** the owner switches Show prices on the booking page off
- **THEN** it saves, and the online booking page lists services without prices

#### Scenario: A sloppy value
- **WHEN** a request sends Show prices on the booking page as the text "false" or the number 1
- **THEN** it is refused with "showPricesOnline must be true or false" and the setting is unchanged
