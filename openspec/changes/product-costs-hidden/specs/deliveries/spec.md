## ADDED Requirements

### Requirement: A new order by someone who can't see costs
Someone allowed to order who can't see costs (until roles, a person at the Owner's till) SHALL be shown no cost and no total on New order. The server SHALL ignore any cost they send: each line SHALL take the cost already on that draft's line, otherwise the product's stored cost. If a line then has no cost, the order SHALL save as a draft and SHALL NOT be marked as ordered, by them, until it has one.

#### Scenario: Jo Taylor orders the brake pads at the Owner's till
- **WHEN** Jo Taylor saves a new order for Shimano brake pads
- **THEN** the line holds the product's stored cost, not £0, and no cost is on the page or in what the server sent

#### Scenario: a line with no cost
- **WHEN** Jo Taylor marks as ordered a new order with a product that has no cost recorded
- **THEN** it is refused with the reason, and Save as draft still works
