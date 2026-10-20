## ADDED Requirements

### Requirement: Pill choices work from the keyboard as radios
Each group of pill choices in the staff app SHALL be one Tab stop, on the picked pill or the first, and the arrow keys SHALL move between its pills, wrapping, picking the one moved to unless picking opens a question.

#### Scenario: Choosing a mechanic by keyboard
- **WHEN** a staff member tabs to the request's Mechanic pills and presses the right arrow
- **THEN** focus and the choice move to the next pill, wrapping from the last to the first
