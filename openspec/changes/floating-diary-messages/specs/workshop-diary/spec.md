## ADDED Requirements

### Requirement: The diary's passing messages float without moving the page
New job's "Choose a time for the new job." bar and a refused move's "Couldn't move …" message SHALL float at the bottom of the screen over the diary, so the diary does not move when they appear or go (Jack, 16 Oct). The "Couldn't move …" message SHALL have a "Close the message" button that removes it.

#### Scenario: Pressing New job
- **WHEN** staff press New job
- **THEN** "Choose a time for the new job." shows at the bottom of the screen and the diary stays where it was

#### Scenario: Closing a refused move's message
- **WHEN** a move is refused and staff press "Close the message"
- **THEN** the message goes
