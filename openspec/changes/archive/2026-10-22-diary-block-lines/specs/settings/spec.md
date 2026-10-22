## ADDED Requirements

### Requirement: The shop chooses what a diary block shows first and second
Settings › Workshop SHALL have a Diary blocks section with a First line and a Second line, each one of Bike, Job title, Customer or Job number, saved as soon as chosen, with a preview and the note "The status always shows too, whatever the two lines above are set to." (`set-workshop-diary`; Workshop day 17, 29). Bike, then job title, SHALL be the default. The two lines SHALL never be the same: choosing the other line's choice SHALL swap them.

#### Scenario: Customer first
- **WHEN** the Owner chooses Customer for the first line
- **THEN** it saves, and the preview reads "Maya Patel", then "Standard service", then "Expected"

#### Scenario: Swapping the lines
- **WHEN** the lines are Bike then Job title and the Owner chooses Bike for the second line
- **THEN** they become Job title then Bike
