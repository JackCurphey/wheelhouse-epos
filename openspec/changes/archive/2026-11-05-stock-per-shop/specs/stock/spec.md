## ADDED Requirements

### Requirement: Every business has a first shop
Every business SHALL have at least one shop: one made when it signs up, and one given to any business already here with none. It SHALL be named after the business, with the first letter of its name as its code, or A where the name has no letter. A business with a shop already SHALL keep what it has, and get no other.

#### Scenario: Signing up
- **WHEN** North Street Cycles signs up
- **THEN** it has one shop, North Street Cycles, code N, and Set up this till offers it, with N1 as the first till number

#### Scenario: A business with Bolton already
- **WHEN** this reaches a business that already has Bolton
- **THEN** it has Bolton and nothing else

### Requirement: Stock is held at each shop, with the total kept beside it
Each product's stock SHALL be held per shop. The business's total SHALL stay on the product, and SHALL always equal the sum of its shops, because the one function that changes stock changes both together. Whatever reads the total SHALL read what it read before: the old till, Shopify, reports, the stock list and the below-zero warning.

#### Scenario: A change at a till
- **WHEN** a till at [Second site] sells one Shimano brake pads, with 5 at the first shop and 3 at [Second site]
- **THEN** [Second site] has 2, the first shop has 5 and the total is 7

#### Scenario: A change with no shop of its own
- **WHEN** stock changes from an ordinary browser, Shopify or the Citrus Lime import
- **THEN** it is the business's oldest shop's

#### Scenario: Stock already here
- **WHEN** this reaches a product with stock
- **THEN** all of it is at the business's oldest shop, below zero included, and its total hasn't changed

### Requirement: Every stock line says its shop
Older stock lines SHALL be given their shop: a till sale's line the till's shop, any other the business's oldest. A line that says already SHALL keep it. Every new line SHALL say its shop.

#### Scenario: An older till sale
- **WHEN** a line from before this records a sale on a till at [Second site]
- **THEN** it says [Second site]

### Requirement: Adjust stock works on this shop's figure
Adjust stock SHALL show this shop's figure and SHALL refuse to take this shop below zero, whatever another shop holds. A sale on the old till SHALL still be checked against the total, as it always has been, so it can take one shop below zero. Going up SHALL always be allowed.

#### Scenario: Nothing at this shop
- **WHEN** a till at [Second site], where there are none, adjusts a product the first shop has 5 of, by one fewer
- **THEN** it says "Stock cannot go below zero" and nothing changes

### Requirement: A product's page shows its stock at each shop
A product's page SHALL list each shop with its stock, oldest first, for everyone with the Stock page, Staff included. With more than one shop its low-stock level SHALL read "[n] each".

#### Scenario: Two shops
- **WHEN** Jack Lewis opens Shimano brake pads with two shops
- **THEN** In stock lists Bolton [n] and [Second site] [n], then Low-stock level [n] each
