## ADDED Requirements

### Requirement: Print labels starts with what needs one
Delivery booked in SHALL offer Print labels to everyone when anything was booked in. Its box SHALL list what was booked in: a product with no barcode of its own starting at one label per item received, and a product with its own barcode starting at 0. Any count SHALL be changeable, by stepping or typing, down to 0.

#### Scenario: no barcode of its own
- **WHEN** [n] of [Product], with no barcode of its own, were booked in
- **THEN** its line reads "No barcode of its own · [n] received" and starts at [n]

#### Scenario: the maker's barcode
- **WHEN** Shimano brake pads with their own barcode were booked in
- **THEN** the line reads "Has its own barcode · [n] received" and starts at 0, and the button reads "Print 0 labels" and is off

#### Scenario: nothing booked in
- **WHEN** everything in the delivery was set aside
- **THEN** there is no Print labels button

### Requirement: Labels print through the browser, one a page
Print SHALL send the browser one label per count, each one page at the shop's label size, with the product's name, price and a barcode of its barcode or, with none, its code, with that code in words under it. A product with neither SHALL print its name and price only. If the label size can't be loaded, the box SHALL say so and SHALL NOT print.

#### Scenario: [Product] with a code and no barcode
- **WHEN** 2 labels of [Product], code [Supplier code], are printed
- **THEN** the browser's print window opens with 2 labels, each with [Product], its price, and a barcode of [Supplier code]
