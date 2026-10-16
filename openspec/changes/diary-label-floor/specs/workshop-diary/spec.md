## ADDED Requirements

### Requirement: Diary labels are at least 12 pixels
Every label on the diary and its pop-ups SHALL be at least 12 pixels on every screen (Jack, 16 Oct). A job block too short for two lines SHALL show the bike only, its job staying in its description and summary.

#### Scenario: A half-hour job
- **WHEN** a Giant Escape is booked for a half-hour Safety check
- **THEN** its block shows "Giant Escape" only, and an hour-long job shows its title too
