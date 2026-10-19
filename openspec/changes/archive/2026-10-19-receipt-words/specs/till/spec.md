## ADDED Requirements

### Requirement: The receipt prints the shop's words above the barcode
The printed receipt SHALL print the shop's words at the bottom just above the barcode, after the shop's details, keeping their line breaks, and nothing when there are none (`set-till-receipts`' preview; Jack, 19 Oct).

#### Scenario: Words set
- **WHEN** the shop's words at the bottom are its returns policy
- **THEN** each receipt prints them between the VAT number and the barcode
