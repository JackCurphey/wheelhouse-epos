## ADDED Requirements

### Requirement: A shop keeps its details in Settings
Settings › Shop and sites › Shop details SHALL hold the shop's name, address, phone, email and VAT number, each saved when its box is left (`set-shop-details`; Jack, 18 Oct). They are one set for the whole business until shops have sites (decision answer 1). The name SHALL NOT be blank.

#### Scenario: Entering the address
- **WHEN** the owner types the address into Shop details and moves on
- **THEN** it is saved, and the next receipt prints it

#### Scenario: Leaving the VAT number blank
- **WHEN** a shop that isn't VAT-registered leaves the VAT number empty
- **THEN** it stays empty and receipts print no VAT number
