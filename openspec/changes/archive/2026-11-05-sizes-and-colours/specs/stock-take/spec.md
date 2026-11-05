## ADDED Requirements

### Requirement: A count names a size by its product and its size and colour
Wherever a count lists a product, a size SHALL be named by its product with sizes, with "Size M · [Colour 1]" in place of its code; a size alone SHALL read "Size L" and a colour alone "[Colour 2]". The count's download SHALL have Size and Colour columns.

#### Scenario: Below zero
- **WHEN** a size is still to find on a below-zero count
- **THEN** it reads "[Product with sizes]" over "Size M · [Colour 1]"

#### Scenario: The check
- **WHEN** a size differs on the check
- **THEN** it reads "[Product with sizes]" with "Size M · [Colour 1]" and "was below zero" under it
