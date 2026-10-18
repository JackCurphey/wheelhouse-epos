## ADDED Requirements

### Requirement: A shop chooses whether customers see who signed off
A shop setting, "Show who signed off to customers", SHALL start off (Jack, 16 Oct, answer 3), and SHALL be changed in Settings › Workshop › Mechanics. While it is off, customers SHALL NOT see who signed a job off.

#### Scenario: Off to start
- **WHEN** a new shop's workshop settings are read
- **THEN** "Show who signed off to customers" is off

### Requirement: The booking link says who checked the job
With the setting on, the booking link of a signed-off job that is ready or collected SHALL say "Checked by [name]", the name kept with the sign-off.

#### Scenario: Ready, setting on
- **WHEN** WH-1042, signed off by Alex Morgan, is ready to collect and the setting is on
- **THEN** Maya's booking link says "Checked by Alex Morgan"

#### Scenario: Setting off
- **WHEN** the setting is off
- **THEN** the booking link names nobody
