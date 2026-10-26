# Spec Delta

## ADDED Requirements

### Requirement: A job's details saved twice at once both stay
When two saves of different details of the same job arrive at the same moment without the version they were made from, each SHALL be kept: the second save SHALL start from what the first wrote, never from what was stored before it. A save that sends a version that is no longer current SHALL still be refused as changed while it was being looked at. The checks on what is sent (a title, a real date, a time on offer, finished work), and which shop's jobs a save can reach, SHALL be unchanged.

#### Scenario: A title and a note at once
- **WHEN** a job's new title and a new note save at the same moment, neither sending a version
- **THEN** both are stored

#### Scenario: A refused save
- **WHEN** a job save is refused because the date isn't a date
- **THEN** nothing it sent is stored, and the next save goes straight through
