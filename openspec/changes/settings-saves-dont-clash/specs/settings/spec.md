# Spec Delta

## ADDED Requirements

### Requirement: Two settings saved at the same moment both stay
When two saves of different settings for the same shop arrive at the same moment, each SHALL be kept: the second save SHALL start from what the first wrote, never from what was stored before it. This covers Settings › Workshop (opening hours, booking rules, deposits and the rest of the workshop settings), the sticker label size, and the website settings. The checks on what is sent, and which shop's settings a save can reach, SHALL be unchanged.

#### Scenario: Deposits switched on while How much saves
- **WHEN** the Owner switches "Take a deposit when booking" on and, at the same moment, a new "How much" saves
- **THEN** deposits are on and the new amount is stored

#### Scenario: Label width and height at once
- **WHEN** a new label width and a new label height save at the same moment
- **THEN** both are stored

#### Scenario: Website tagline and description at once
- **WHEN** a new tagline and a new description save at the same moment
- **THEN** both are stored

#### Scenario: A shop's first two website saves at once
- **WHEN** a shop that has never saved its website settings saves two of them at the same moment
- **THEN** both saves work and both are stored

#### Scenario: A refused save
- **WHEN** a save is refused because something sent isn't allowed
- **THEN** nothing it sent is stored, and the next save goes straight through
