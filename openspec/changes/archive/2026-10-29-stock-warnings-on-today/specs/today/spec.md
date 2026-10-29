# Spec Delta

## ADDED Requirements

### Requirement: A big stock adjustment goes to Needs attention until Seen
An adjustment worth more, at cost, than the amount set in Settings › Stockroom SHALL be on the Owner's Needs attention until Seen: "Stock adjusted: [Product] [change] · £[value]", with the product's name opening its page, and "[Reason] · by [Name] at [time]" (stock control decision 6; `st-today-adjust`). An adjustment from an earlier day SHALL give its day too. Seen SHALL take the line off in one click and record who and when. Only the Owner SHALL see the line or press Seen, until roles.

#### Scenario: Jo Taylor writes off damaged stock
- **WHEN** the amount set is £[amount] and Jo Taylor adjusts a product down with Damaged, worth more than that at cost
- **THEN** Jack Lewis's Needs attention shows "Stock adjusted: [Product] −[n] · £[value]" and "Damaged · by Jo Taylor at [time]", with Seen

#### Scenario: A small adjustment
- **WHEN** an adjustment is worth the amount set or less, or no amount is set
- **THEN** it is only in the product's stock history

#### Scenario: Seen
- **WHEN** Jack Lewis presses Seen
- **THEN** the line goes and stays gone

### Requirement: Products below zero go to Needs attention, with Count them
When any product is below zero, the Owner's Needs attention SHALL show "[n] products below zero" and "Sold more than Wheelhouse thought were here · Count them starts a count straight away", with See them and Count them (stock control decision 9; `st-today-below`). See them SHALL open Stock with Below zero picked. Count them SHALL start a stock take of just those products and open its counting page; if one is already counting, it SHALL open that one. The line SHALL go when none are below zero. On a phone See them and Count them SHALL sit under the words.

#### Scenario: Two products sold below zero
- **WHEN** two products are below zero and Jack Lewis opens Today
- **THEN** Needs attention shows "2 products below zero" with See them and Count them

#### Scenario: Count them
- **WHEN** Jack Lewis presses Count them
- **THEN** a below-zero count starts and its counting page opens

#### Scenario: Nothing below zero
- **WHEN** no product is below zero
- **THEN** there is no below-zero line
