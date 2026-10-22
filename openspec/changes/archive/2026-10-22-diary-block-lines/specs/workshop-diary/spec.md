## ADDED Requirements

### Requirement: A diary block shows the shop's chosen lines
A diary block, a stack's front card and a fanned stack's tiles SHALL show the shop's first and second choice from Settings › Workshop › Diary blocks, in place of the bike and the job title. A block's name for screen readers SHALL still give the bike, job, customer, number, status and time.

#### Scenario: Customer, then job number
- **WHEN** the shop chose Customer, then Job number, and Maya Patel's job WH-1001 is in the diary
- **THEN** its block reads "Maya Patel", then "WH-1001"
