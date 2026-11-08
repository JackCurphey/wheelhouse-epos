## MODIFIED Requirements

### Requirement: A product's page
A product's page SHALL show: back to Stock, its name, photo and codes; In stock with its low-stock level; its details; its price and VAT; and its stock history newest first, which can be narrowed to Sold, Received, or Counted and adjusted (`st-product`). Each history line SHALL say who made it where that is recorded. Anyone with the page SHALL be able to Adjust stock; the Owner SHALL also be able to Edit it.

#### Scenario: The brake pads' history
- **WHEN** staff open Shimano brake pads and press Sold
- **THEN** only the lines where it was sold show, newest first

#### Scenario: Staff see no Edit
- **WHEN** Jo Taylor opens Shimano brake pads
- **THEN** there is Adjust stock but no Edit

## ADDED Requirements

### Requirement: The Owner edits a product on its page
Edit SHALL open one box with the product's name, supplier code, barcode, supplier, cost, price, low-stock level, category and that category's details, filled in. Saving SHALL save the product and then its details, and show the server's words if either is refused, keeping the box open. Prices and costs SHALL be typed in pounds and saved in whole pence.

#### Scenario: Changing the price
- **WHEN** the Owner edits Shimano brake pads and changes the price from £28.00 to £[price]
- **THEN** the page shows £[price]

#### Scenario: A bearing's outer diameter
- **WHEN** the Owner edits a bearing in Bearings and types 30 in Outer diameter
- **THEN** its Details · Bearings box reads "Outer diameter 30 mm"

### Requirement: A price or cost change goes into the history
Every change to a product's price or cost, from its page, a size's save or a delivery, SHALL be kept with what it was, what it became, who and when. The Owner SHALL see them in the product's history, "Price changed · £28.00 → £[price]", with a Price changes filter; staff SHALL NOT be sent them. Adding a product SHALL record no change.

#### Scenario: Jack changes the price
- **WHEN** Jack Lewis changes Shimano brake pads from £28.00 to £[price]
- **THEN** the history's newest line reads "Price changed · £28.00 → £[price]" with Jack Lewis

#### Scenario: Jo opens the page
- **WHEN** Jo Taylor opens the same page
- **THEN** no price or cost change is in what the server sent

### Requirement: A product with sizes has its own page
A product with sizes SHALL open from its Stock row on a page with its category and how many sizes and colours, its stock at each shop, its prices, a grid of sizes across and colours down with each cell's stock opening that size, and one history for all its sizes saying each line's size and colour (`st-product-sizes`). The Owner SHALL be able to add a size or colour and edit its name and category there.

#### Scenario: The grid
- **WHEN** someone opens [Product with sizes] in S, M, L and XL and two colours, with M in [Colour 1] below zero
- **THEN** the grid shows that cell as below zero, and pressing it opens size M in [Colour 1]

#### Scenario: Adding a size
- **WHEN** the Owner adds size XL in [Colour 2] with its barcode and price
- **THEN** it is in the grid, named "[Product with sizes] XL [Colour 2]"

### Requirement: The Owner adds a product on screen
"+ Add a product" on Stock, "+ Add “[typed]” as a product" when nothing matches, and the new shop's "+ Add a product" SHALL open the product box empty, for the Owner only. Once added, its page SHALL open.

#### Scenario: Nothing matches
- **WHEN** the Owner searches "[what was typed]", finds nothing and presses "+ Add “[what was typed]” as a product"
- **THEN** the box opens with that name filled in
