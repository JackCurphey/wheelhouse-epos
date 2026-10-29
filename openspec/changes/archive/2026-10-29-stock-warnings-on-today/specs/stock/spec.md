# Spec Delta

## ADDED Requirements

### Requirement: An adjustment keeps its value at cost
Every adjustment SHALL keep its value at cost when it was made: how many it moved, up or down, times the product's cost, in whole pence. Whether it goes to Today SHALL be settled when it is made, against the amount set then.

#### Scenario: The cost changes later
- **WHEN** an adjustment was worth £[value] and the product's cost changes afterwards
- **THEN** Today's line still says £[value]

### Requirement: Stock opens with Below zero picked from Today
Stock SHALL open with Below zero picked when it is opened from Today's See them.

#### Scenario: See them
- **WHEN** Jack Lewis presses See them on Today's below-zero line
- **THEN** Stock opens listing only the products below zero, with Below zero picked
