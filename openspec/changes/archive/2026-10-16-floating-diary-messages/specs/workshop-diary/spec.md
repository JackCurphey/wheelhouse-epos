## ADDED Requirements

### Requirement: The diary's passing messages float without moving the page
New job's "Choose a time for the new job." bar and a refused move's "Couldn't move …" message SHALL float at the bottom of the screen over the diary, so the diary does not move when they appear or go (Jack, 16 Oct). The page SHALL keep room at its foot while they show, so they never hide the last hour of the diary. On a phone they SHALL sit at the foot of the page above the chosen Waiting card's bar, never over it. Pressing New job SHALL put the focus on "Enter a time instead". The "Couldn't move …" message SHALL have a "Close the message" button that removes it, and SHALL open under a job's menu, not over it.

#### Scenario: Pressing New job
- **WHEN** staff press New job
- **THEN** "Choose a time for the new job." shows at the bottom of the screen and the diary stays where it was

#### Scenario: Closing a refused move's message
- **WHEN** a move is refused and staff press "Close the message"
- **THEN** the message goes
