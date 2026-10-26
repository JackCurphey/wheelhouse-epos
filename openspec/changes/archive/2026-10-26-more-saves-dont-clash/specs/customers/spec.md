# Spec Delta

## ADDED Requirements

### Requirement: A customer's or a bike's details saved twice at once both stay
When two saves of different details of the same customer, or of the same bike, arrive at the same moment, each SHALL be kept: the second save SHALL start from what the first wrote, never from what was stored before it. The checks on what is sent, and which shop's customers and bikes a save can reach, SHALL be unchanged.

#### Scenario: A phone number and a note at once
- **WHEN** a customer's new phone number and a new note save at the same moment
- **THEN** both are stored

#### Scenario: A bike's colour and frame number at once
- **WHEN** a bike's new colour and its frame number save at the same moment
- **THEN** both are stored

#### Scenario: A refused save
- **WHEN** a customer save is refused because the name is empty
- **THEN** nothing it sent is stored, and the next save goes straight through
