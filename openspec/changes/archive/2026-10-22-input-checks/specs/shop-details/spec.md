## MODIFIED Requirements

### Requirement: The shop chooses whether the booking page shows prices
Settings › Workshop › Online booking SHALL have "Show prices on the booking page", On or Off, saved as soon as it's switched (`bk-settings`; Jack, 19 Oct). Off SHALL never hide a quote's prices: the customer is approving an amount (Jack, 21 Oct, `docs/decisions/2026-10-21-quote-prices.md`). The server SHALL take only a real true or false for it; anything else SHALL be refused and change nothing.

#### Scenario: Hiding prices
- **WHEN** the owner switches Show prices on the booking page off
- **THEN** it saves, and the online booking page lists services without prices

#### Scenario: A quote keeps its prices
- **WHEN** Show prices is off and the shop sends a quote for brake pads at £18 and a gear cable at £12
- **THEN** the customer's quote shows £18, £12 and the £30 total

#### Scenario: A sloppy value
- **WHEN** a request sends Show prices on the booking page as the text "false" or the number 1
- **THEN** it is refused with "showPricesOnline must be true or false" and the setting is unchanged
