## ADDED Requirements

### Requirement: By mechanic columns stay readable on a phone
On a phone, each "By mechanic" column SHALL be at least 96 pixels wide; when they don't all fit, the diary SHALL scroll sideways inside its own area, with the times staying put and the mechanics' names moving with their columns, and the page SHALL NOT scroll sideways (Jack, 17 Oct). A job dragged there SHALL only land on the part of a column that can be seen; let go over the times, and it stays with its own mechanic.

#### Scenario: Six mechanics on a 360px phone
- **WHEN** a 360-pixel phone shows By mechanic for six mechanics
- **THEN** each column is at least 96 pixels wide, the diary area swipes sideways, and the page itself doesn't
