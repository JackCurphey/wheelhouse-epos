# Spec Delta

## ADDED Requirements

### Requirement: A supplier or a draft order saved twice at once both stay
When two saves of different details of the same supplier, or of the same draft order, arrive at the same moment, each SHALL be kept: the second save SHALL start from what the first wrote, never from what was stored before it. The checks on what is sent, and which shop's suppliers and orders a save can reach, SHALL be unchanged.

#### Scenario: A supplier's contact and phone at once
- **WHEN** a supplier's new contact name and new phone number save at the same moment
- **THEN** both are stored

#### Scenario: An order's reference and notes at once
- **WHEN** a draft order's new reference and new notes save at the same moment
- **THEN** both are stored

### Requirement: Only a draft order is edited, even when it is ordered mid-save
A change to an order SHALL be checked against the order as it is when the change is written, not as it was when the change arrived. An order marked as ordered while a change to it is waiting SHALL refuse the change with "Only a draft purchase order can be edited", and keep its lines and notes as they were.

#### Scenario: Marked as ordered while an edit waits
- **WHEN** an order is marked as ordered while an edit to its lines is waiting
- **THEN** the edit is refused and the order's lines are unchanged
