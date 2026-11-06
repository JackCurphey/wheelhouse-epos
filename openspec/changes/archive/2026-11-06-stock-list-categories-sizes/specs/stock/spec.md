## ADDED Requirements

### Requirement: The list shows a product with sizes on one row
The Stock list SHALL show a product with sizes as one row with its category, how many sizes and colours it has, how many sizes are below zero or running low, its total stock and its prices from lowest to highest. Searching a size or colour SHALL show each size found on its own row, with its size, colour and barcode, opening that size.

#### Scenario: A jersey in sizes
- **WHEN** the list holds [Jersey] in M and L, [Red] and [Blue], one size below zero, priced £30.00 and £35.00
- **THEN** its row reads "[Clothing] · 2 sizes · 2 colours · 1 size below zero", with the total stock and "£30.00–£35.00"

#### Scenario: Searching a size
- **WHEN** someone searches "jersey M"
- **THEN** each M is its own row, "Size M · [Red] · [barcode]", and opens that size's page

### Requirement: A category picked on the list filters by its details
The Stock list SHALL let a category be picked by searching for it, shown as a dark pill that can be removed. A picked category's details, its own and those passed down, SHALL become filters and, on a computer, columns. A measurement searched SHALL show each row's details on its line, the one matched in bold. The list's answer SHALL carry each row's answers only when a category is picked or a measurement searched, and each row's VAT rate.

#### Scenario: Bearings with an outer diameter of 30 mm
- **WHEN** the Owner picks Bearings and types 30 in Outer diameter
- **THEN** the list shows the bearings answering 30 mm, with Inner diameter, Outer diameter and Height as columns, and says "2 in Bearings with Outer diameter 30 mm"

#### Scenario: The plain list
- **WHEN** no category is picked and no measurement is searched
- **THEN** the list's answer carries no product's answers
