## ADDED Requirements

### Requirement: A product with sizes and colours is one product
A product with sizes and colours SHALL be one product people see, with each size and colour its own product underneath, with its own barcode, code, price, cost and stock. Each size and colour SHALL be in a product once, whatever its case. Everything that sells, orders, receives, counts or changes stock SHALL treat each size as the product it is, unchanged.

#### Scenario: Selling a size
- **WHEN** size M in [Colour 1] is sold on the old till
- **THEN** that size's stock goes down as any product's does, and the product's total with it

### Requirement: Stock lists a product with sizes once
The new stock list SHALL show one row for a product with sizes, with its total stock, how many sizes and colours it has, how many sizes are below zero and running low, and its lowest and highest price. Staff SHALL see no cost.

#### Scenario: The list
- **WHEN** Jack Lewis opens Stock with a product with sizes in two sizes and two colours, one size below zero
- **THEN** it is one row, "[n] sizes · [n] colours · 1 size below zero", with its total

### Requirement: Searching a size opens that size
Searching SHALL find a size by its barcode or code, and by its product's name with its size or colour, each its own row named by its product with its size and colour. A product's name alone SHALL find the product's one row.

#### Scenario: Jersey M
- **WHEN** someone searches "[Product with sizes] M"
- **THEN** size M in each colour it comes in is listed, each with its own stock and price

### Requirement: A product with sizes has its grid
A product with sizes SHALL list its sizes and its colours, and each size and colour with its own barcode, stock and price, for its grid.

#### Scenario: Its grid
- **WHEN** its page is opened
- **THEN** it has its sizes and colours in the order they were made, and each size and colour's own figures
