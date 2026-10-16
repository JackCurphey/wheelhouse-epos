## ADDED Requirements

### Requirement: The diary fits an upright tablet
Between phone width and computer width (an upright tablet), the diary's toolbar SHALL sit on two rows, Week/Day with the dates above, the people chips, a "Waiting" button with its count and New job below; "Waiting for you" SHALL be that button, opening the same Waiting list as the phone, and the week SHALL take the full width (Jack approved the drawing, 16 Oct). A card chosen from that list SHALL show the phone's chosen-card bar, with Open, at the foot of the page, with any passing message above it. On a computer the Waiting column SHALL stay beside the diary.

#### Scenario: An iPad held upright
- **WHEN** the diary is opened 834 pixels wide
- **THEN** there is no Waiting column, New job sits on the row below Week/Day, and "Waiting" opens the Waiting list

#### Scenario: A computer
- **WHEN** the diary is opened 1280 pixels wide
- **THEN** "Waiting for you" is a column beside the diary and there is no Waiting button
