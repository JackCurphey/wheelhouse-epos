## ADDED Requirements

### Requirement: An unknown barcode searched on Stock
A search on Stock of only digits, 8 to 14 of them, that matches nothing SHALL say "Barcode [barcode] isn’t in Wheelhouse yet" (`st-list-unknown`). The Owner SHALL be offered Add this product, opening the product box with that barcode filled in; Staff SHALL be told only the shop's owner can add products.

#### Scenario: The Owner scans an unknown barcode into Stock's search
- **WHEN** the Owner searches Stock for a barcode no product has
- **THEN** it says the barcode isn't in Wheelhouse yet, and Add this product opens the box with the barcode filled in

#### Scenario: Jo Taylor
- **WHEN** Jo Taylor (Staff) searches for the same barcode
- **THEN** she sees the heading and "Only the shop’s owner can add products for now.", and no Add this product
