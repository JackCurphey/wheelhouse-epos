# Spec Delta

## ADDED Requirements

### Requirement: Stock opens on a searchable list
The Stock page SHALL list the shop's products, each with its name, its code, category and supplier, its stock, and its price, and SHALL find products by name, barcode, code or supplier from one search box (`st-list`). Each product SHALL open its own page.

#### Scenario: Finding the brake pads
- **WHEN** staff type "B05S" into Search stock
- **THEN** Shimano brake pads B05S-RX shows, with its stock and £28.00

### Requirement: Running low and Below zero
A product with a low-stock level whose stock is at or under it SHALL show "Running low"; a product under zero SHALL show "Below zero". The Running low and Below zero filters SHALL show only those products.

#### Scenario: Below zero
- **WHEN** staff press Below zero
- **THEN** only products with stock under 0 are listed, each marked Below zero

### Requirement: Margin and cost for the Owner only
The list's Margin and the product page's Cost, Margin and Show on website SHALL show only to the Owner, and the product's page SHALL not send its cost to anyone else (stock decision 11).

#### Scenario: Jo Taylor opens the brake pads
- **WHEN** Jo Taylor (Staff) opens Shimano brake pads
- **THEN** she sees Price and VAT, and no Cost or Margin

### Requirement: A product's page
A product's page SHALL show: back to Stock, its name, photo and codes; In stock with its low-stock level; its price and VAT; and its stock history newest first, which can be narrowed to Sold, Received, or Counted and adjusted (`st-product`). Nothing on the page SHALL change stock or the product.

#### Scenario: The brake pads' history
- **WHEN** staff open Shimano brake pads and press Sold
- **THEN** only the lines where it was sold show, newest first
