# Spec Delta

## ADDED Requirements

### Requirement: Customer groups
Settings › Front desk › Payments SHALL have a Customer groups fold listing each group with its name, how many current customers are in it, its discount and Edit, the note "The till gives the discount by itself when a group member is added to a sale, with the group as the reason.", and "+ Add a group". A group's box SHALL take a name and a percentage off between 0 and 100, save them, and remove the group.

#### Scenario: the club's members
- **WHEN** the owner opens Settings › Front desk › Payments with a group "Club members" at 10% off and three customers in it
- **THEN** it shows "Club members", "3 customers" and "10% off"

#### Scenario: a new group
- **WHEN** the owner adds a group "Blue Light" at 15% off
- **THEN** it is listed with "0 customers" and "15% off"
