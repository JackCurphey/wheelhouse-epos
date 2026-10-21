## ADDED Requirements

### Requirement: The Workshop Overview shows the day's planned effort
The Overview SHALL show Planned effort as the day's booked work against the mechanics' working time, in hours to the half hour, with overlaps counted once and the shared queue included. A bar SHALL show the share used. Planned effort SHALL be left out while the figures can't be read.

#### Scenario: Six hours of eight
- **WHEN** the day has 6 hours of work booked and the mechanics have 8 hours
- **THEN** Planned effort reads "6h / 8h", with a bar three quarters full
