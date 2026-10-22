## ADDED Requirements

### Requirement: The customer can set a spending limit when booking
The booking's bike step SHALL ask "If the mechanic finds more to do", with "Ask me before any extra work" chosen to start and "Go ahead if the whole bill comes to no more than £[amount]", the amount in whole pounds (Workshop day 41). A limit SHALL be stored on the job; asking first stores none.

#### Scenario: Setting £200
- **WHEN** Maya chooses Go ahead and leaves £200, then books
- **THEN** her job's limit is £200, and her summary says "Extra work: go ahead if the whole bill is no more than £200"

#### Scenario: Not a whole amount
- **WHEN** Maya chooses Go ahead and enters "150.50"
- **THEN** Continue is refused with "Enter the most the whole bill can come to, in whole pounds."
