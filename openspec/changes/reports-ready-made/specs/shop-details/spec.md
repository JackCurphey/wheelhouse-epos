## ADDED Requirements

### Requirement: A shop keeps when its VAT quarter starts
Settings › Shop and sites › Shop details SHALL hold when the shop's VAT quarter starts, as one of "January, April, July, October", "February, May, August, November" or "March, June, September, December", or not said yet. It SHALL be one setting for the whole business, as the VAT number is, saved when chosen, and changed only by the Owner. The VAT report SHALL ask for it once if it isn't said (`rp-vat-first`).

#### Scenario: changing the VAT quarter later
- **WHEN** the owner chooses "February, May, August, November" in Shop details
- **THEN** it is saved, and the VAT report's quarters start in those months
