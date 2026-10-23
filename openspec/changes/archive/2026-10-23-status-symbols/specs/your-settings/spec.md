## ADDED Requirements

### Requirement: Show status symbols

With Show status symbols on, the diary's week blocks, its requests and the
legend's swatches SHALL each carry their status's shape as well as its colour;
with it off, status SHALL be colour alone, as before. The shape SHALL be
hidden from screen readers, which hear the status word.

#### Scenario: turned on
- **WHEN** the person turns Show status symbols on and opens the diary's week
- **THEN** each block shows its status's shape in its top-right corner, and the legend shows the same shapes

#### Scenario: off
- **WHEN** the switch is off
- **THEN** no block or swatch carries a shape
