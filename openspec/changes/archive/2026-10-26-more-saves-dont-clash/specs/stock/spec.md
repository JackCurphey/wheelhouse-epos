# Spec Delta

## ADDED Requirements

### Requirement: A product's details saved twice at once both stay
When two saves of different details of the same product arrive at the same moment, each SHALL be kept: the second save SHALL start from what the first wrote, never from what was stored before it. The checks on what is sent (a name, a code or barcode no other product has), and which shop's products a save can reach, SHALL be unchanged.

#### Scenario: A price and a description at once
- **WHEN** a product's new price and a new description save at the same moment
- **THEN** both are stored

#### Scenario: A refused save
- **WHEN** a product save is refused because the name is empty
- **THEN** nothing it sent is stored, and the next save goes straight through
