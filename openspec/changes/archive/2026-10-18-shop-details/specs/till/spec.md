## ADDED Requirements

### Requirement: The receipt carries the shop's details at the bottom, then the barcode
The printed receipt SHALL show the shop's name, sale number and date and time at the top, and the shop's address, phone and "VAT number [n]" at the bottom, each left out when blank, with the barcode last (Jack, 18 Oct, shop details answer 2).

#### Scenario: Details filled in
- **WHEN** North Street Cycles has its address, phone and VAT number in Shop details
- **THEN** each receipt prints them after "Paid by", above the barcode

#### Scenario: No details yet
- **WHEN** Shop details is empty
- **THEN** the receipt ends with the barcode after "Paid by"
