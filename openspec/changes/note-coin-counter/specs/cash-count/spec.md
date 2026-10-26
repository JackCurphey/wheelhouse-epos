# Spec Delta

## ADDED Requirements

### Requirement: A box for every note and coin
The counter SHALL show one box for each of £50, £20, £10, £5, £2, £1, 50p, 20p, 10p, 5p, 2p and 1p, in that order, in a group named "Count each note and coin", each box named "Number of [note or coin]" (cash-up decision 3; `eod-count`, `op-float-count`).

#### Scenario: Opening the count
- **WHEN** Jo Taylor presses Count it on the float check
- **THEN** she sees twelve empty boxes from £50 down to 1p, and an empty Cash counted

### Requirement: The boxes add up
Each box SHALL take a whole number of that note or coin. Cash counted SHALL show the boxes added up, in pounds and pence, and on a computer or tablet each filled box SHALL show what it is worth. Every sum SHALL be worked out in whole pence, so coins add up exactly.

#### Scenario: The drawing's count
- **WHEN** staff fill in 6 × £20, 5 × £10, 4 × £5, 3 × £2, 8 × £1, 6 × 50p, 5 × 20p and 7 × 10p
- **THEN** the £20 box shows £120.00 and Cash counted shows £208.70

#### Scenario: Something that isn't a number
- **WHEN** staff type a letter or a minus sign into a box
- **THEN** the box keeps only the digits

### Requirement: The total can be typed over
Staff SHALL be able to type the total into Cash counted instead; a typed total SHALL take over from the boxes (cash-up decision 3). Changing a box again SHALL go back to adding up the boxes, and leaving the total box empty SHALL show the boxes' sum again (while still typing, it stays empty). "£", thousands commas and a trailing point SHALL be accepted.

#### Scenario: Retyping the total
- **WHEN** staff delete the typed total to retype it
- **THEN** the box stays empty until they type again or leave it, when it shows the boxes' sum

#### Scenario: Just typing the total
- **WHEN** staff type "£150.00" into Cash counted
- **THEN** the count is £150.00, whatever the boxes say

### Requirement: A wrong total says so
A total that isn't pounds and pence SHALL be marked as wrong, SHALL say "Pounds and pence, like 208.70" where a screen reader announces it without interrupting, and SHALL count as nothing counted.

#### Scenario: A total with too many pence
- **WHEN** staff type "12.345" into Cash counted
- **THEN** Cash counted is marked as wrong and nothing is counted

### Requirement: It tells the page what was counted
The counter SHALL tell the page around it the amount counted in whole pence, or that nothing has been counted yet, so the page can keep "Done counting" off until a box has a number (opening audit H1). The counter SHALL never show what the till expects (cash-up decision 2: blind counting is the page's choice).

#### Scenario: Nothing typed yet
- **WHEN** the counter opens and nothing has been typed
- **THEN** the page is told nothing has been counted
