## ADDED Requirements

### Requirement: The shop sets its notice in hours or days
Settings › Workshop › Online booking SHALL hold "Notice" as a number with hours or days (`bk-settings-notice-days`; Jack, 19 Oct), saved when changed.

#### Scenario: Switching to days
- **WHEN** the owner sets Notice to 1 and chooses days
- **THEN** it saves one day's notice, and the note says 1 day lets a customer book any time tomorrow
