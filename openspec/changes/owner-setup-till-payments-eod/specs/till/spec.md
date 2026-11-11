# Spec Delta

## ADDED Requirements

### Requirement: The till's quick buttons are the shop's own
The till's left side SHALL show the shop's quick-button groups as pills and the chosen group's buttons in a grid, both in the shop's order (selling at the till decision 2; `till.mjs` `leftSide`). The first group SHALL be chosen when the till opens. The grid SHALL have 4 columns on a computer, 3 on a tablet and 2 on a phone. A product taken off sale or a service made inactive SHALL not show.

#### Scenario: Another group
- **WHEN** Jo Taylor taps the Parts pill
- **THEN** the grid shows Parts' buttons in the shop's order

### Requirement: One tap adds a quick button's item at its current price
Each quick button SHALL show its name and its product's or service's current price. One tap SHALL add the item to the basket at that price, as choosing it any other way does. Showing the buttons SHALL change nothing about how a sale is paid or saved.

#### Scenario: Tapping a quick button
- **WHEN** Jo Taylor taps Standard service (£65.00) in the Workshop group
- **THEN** the basket gains Standard service at £65.00

### Requirement: The till says when there are no quick buttons
With no quick buttons on sale, the till's left side SHALL read "No quick buttons yet. Add them in Settings."

#### Scenario: A shop with none
- **WHEN** the shop has no quick buttons
- **THEN** the left side reads "No quick buttons yet. Add them in Settings."
