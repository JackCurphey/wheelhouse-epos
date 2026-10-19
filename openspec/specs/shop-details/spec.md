# shop-details Specification

## Purpose
The shop's own details (name, address, phone, email, VAT number), kept in Settings › Shop and sites and printed on receipts. For now one set covers the whole business; when shops have sites, the address and phone move onto each site and the VAT number stays with the business.

## Requirements

### Requirement: A shop keeps its details in Settings
Settings › Shop and sites › Shop details SHALL hold the shop's name, address, phone, email and VAT number, each saved when its box is left (`set-shop-details`; Jack, 18 Oct). They are one set for the whole business until shops have sites (decision answer 1). The name SHALL NOT be blank.

#### Scenario: Entering the address
- **WHEN** the owner types the address into Shop details and moves on
- **THEN** it is saved, and the next receipt prints it

#### Scenario: Leaving the VAT number blank
- **WHEN** a shop that isn't VAT-registered leaves the VAT number empty
- **THEN** it stays empty and receipts print no VAT number

### Requirement: A shop keeps the words for the bottom of its receipts
Settings › Till › Receipts SHALL hold "Words at the bottom", such as a returns policy or a thank-you, saved when the box is left (`set-till-receipts`; Jack, 19 Oct). Blank means none.

#### Scenario: A returns policy
- **WHEN** the owner types the shop's returns policy into Words at the bottom and moves on
- **THEN** it is saved, and the next receipt prints it
