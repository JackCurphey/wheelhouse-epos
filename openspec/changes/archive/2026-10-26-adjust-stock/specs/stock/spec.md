# Spec Delta

## MODIFIED Requirements

### Requirement: A product's page
A product's page SHALL show: back to Stock, its name, photo and codes; In stock with its low-stock level; its price and VAT; and its stock history newest first, which can be narrowed to Sold, Received, or Counted and adjusted (`st-product`). Each history line SHALL say who made it where that is recorded. The only change made from the page SHALL be Adjust stock.

#### Scenario: The brake pads' history
- **WHEN** staff open Shimano brake pads and press Sold
- **THEN** only the lines where it was sold show, newest first

## ADDED Requirements

### Requirement: Adjust stock with a reason
Anyone with the Stock page SHALL be able to adjust a product's stock from its page by the change or the count after it, with a reason that follows the sign: going down, Damaged, Lost or stolen, Used in the workshop, Faulty — to return to supplier, or Other; going up, Found or Other. Other SHALL need a note. No reason SHALL be picked until one is, and Adjust SHALL say why it can't be pressed yet (`st-adjust`, `st-adjust-faulty`).

#### Scenario: Damaged brake pads
- **WHEN** Jack Lewis opens Shimano brake pads, presses Adjust stock, leaves the change at −1, picks Damaged and presses Adjust
- **THEN** its stock goes down by 1 and the history's newest line reads "Adjusted · Damaged" with his name

#### Scenario: No reason yet
- **WHEN** Jack Lewis opens Adjust stock and picks no reason
- **THEN** Adjust is greyed and says "Pick a reason to adjust"

### Requirement: Every adjustment records who
Every adjustment SHALL be recorded in the product's stock history with its reason, its note, who made it and when.

#### Scenario: Who adjusted it
- **WHEN** Jack Lewis adjusts the brake pads
- **THEN** the line says Jack Lewis

### Requirement: Two adjustments at once both count
Two adjustments made at the same moment SHALL both change the stock; neither SHALL be lost, and they SHALL not take stock below zero.

#### Scenario: Two people take one off at once
- **WHEN** two adjustments of −1 reach a product with 6 in stock at the same moment
- **THEN** it has 4, with two lines in its history

### Requirement: Anyone with the Stock page adjusts
The Owner, Managers and Staff SHALL all see Adjust stock and be able to adjust, since who adjusts what is recorded (Jack, 26 Oct, `docs/decisions/2026-10-26-day-answers.md` section 11).

#### Scenario: Jo Taylor adjusts
- **WHEN** Jo Taylor (Staff) adjusts Shimano brake pads, Lost or stolen
- **THEN** the history's newest line reads "Adjusted · Lost or stolen" with Jo Taylor's name
