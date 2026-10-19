## ADDED Requirements

### Requirement: The shop changes how bikes are booked in from a day it chooses
Settings › Workshop › Online booking SHALL show whether bikes are booked in for a set time or the whole day. Choosing the other SHALL ask "Starting on" which day, tomorrow at the earliest, and save it as a coming change; bookings already made keep their shape (Jack, 24 Sep and 19 Oct). A coming change SHALL show with "Cancel the change".

#### Scenario: Changing to the whole day
- **WHEN** the owner chooses The whole day and picks Thursday 5 November
- **THEN** the section says "Changing to the whole day from Thu 5 Nov. Bookings already made keep their set times." with Cancel the change

#### Scenario: Changing their mind
- **WHEN** the owner presses Cancel the change
- **THEN** the coming change is removed and bikes stay booked in for a set time

### Requirement: The shop sets its drop-off window
While bikes are booked in for the whole day, Settings SHALL show the "Drop-off window", from and to, saved when changed (`bk-settings-whole-day`).

#### Scenario: An earlier window
- **WHEN** the owner sets the window to 08:30 to 10:00
- **THEN** it saves, and whole-day customers are told to drop off between 08:30 and 10:00
