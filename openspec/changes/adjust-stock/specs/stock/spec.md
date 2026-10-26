# Spec Delta

## MODIFIED Requirements

### Requirement: A product's page
A product's page SHALL show: back to Stock, its name, photo and codes; In stock with its low-stock level; its price and VAT; and its stock history newest first, which can be narrowed to Sold, Received, or Counted and adjusted (`st-product`). Each history line SHALL say who made it where that is recorded. The only change made from the page SHALL be Adjust stock.

#### Scenario: The brake pads' history
- **WHEN** staff open Shimano brake pads and press Sold
- **THEN** only the lines where it was sold show, newest first

## ADDED Requirements

### Requirement: Adjust stock with a reason
The Owner SHALL be able to adjust a product's stock from its page by the change or the count after it, with a reason that follows the sign: going down, Damaged, Lost or stolen, Used in the workshop, Faulty — to return to supplier, or Other; going up, Found or Other. Other SHALL need a note. No reason SHALL be picked until one is, and Adjust SHALL say why it can't be pressed yet (`st-adjust`, `st-adjust-faulty`).

#### Scenario: Damaged brake pads
- **WHEN** the Owner opens Shimano brake pads, presses Adjust stock, leaves the change at −1, picks Damaged and presses Adjust
- **THEN** its stock goes down by 1 and the history's newest line reads "Adjusted · Damaged" with the Owner's name

#### Scenario: No reason yet
- **WHEN** the Owner opens Adjust stock and picks no reason
- **THEN** Adjust is greyed and says "Pick a reason to adjust"

### Requirement: Every adjustment records who
Every adjustment SHALL be recorded in the product's stock history with its reason, its note and who made it.

#### Scenario: Who adjusted it
- **WHEN** Jack Lewis adjusts the brake pads
- **THEN** the line says Jack Lewis

### Requirement: Two adjustments at once both count
Two adjustments made at the same moment SHALL both change the stock; neither SHALL be lost, and they SHALL not take stock below zero.

#### Scenario: Two people take one off at once
- **WHEN** two adjustments of −1 reach a product with 6 in stock at the same moment
- **THEN** it has 4, with two lines in its history

### Requirement: Only the Owner adjusts, until roles
Until roles are built, only the Owner SHALL see Adjust stock and be able to adjust; anyone else SHALL be refused.

#### Scenario: Jo Taylor's page
- **WHEN** Jo Taylor (Staff) opens Shimano brake pads
- **THEN** there is no Adjust stock
