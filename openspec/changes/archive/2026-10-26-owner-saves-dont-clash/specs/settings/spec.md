# Spec Delta

## ADDED Requirements

### Requirement: The Owner's workshop and team details saved twice at once both stay
When two saves of different details of the same workshop service, service group, mechanic's time off or person on the team arrive at the same moment, each SHALL be kept: the second save SHALL start from what the first wrote, never from what was stored before it. The checks on what is sent, and which shop's records a save can reach, SHALL be unchanged.

#### Scenario: A service's reminder and its place at once
- **WHEN** a service's reminder months and its place in the list save at the same moment
- **THEN** both are stored

#### Scenario: A group's name and its place at once
- **WHEN** a service group's new name and its new place save at the same moment
- **THEN** both are stored

#### Scenario: Time off's reason and end time at once
- **WHEN** a mechanic's time off gets a new reason and a new end time at the same moment
- **THEN** both are stored

#### Scenario: A person's name and working days at once
- **WHEN** a person's new name and new working days save at the same moment
- **THEN** both are stored

#### Scenario: A refused save
- **WHEN** a service save is refused because it has no name
- **THEN** nothing it sent is stored, and the next save goes straight through
