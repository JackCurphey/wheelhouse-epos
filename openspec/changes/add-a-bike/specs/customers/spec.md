## ADDED Requirements

### Requirement: Staff add a bike from the customer's page

The customer page's Bikes SHALL have "+ Add", opening "Add a bike" with Make, Model, Colour and Serial number, Cancel and Add bike. Adding SHALL list the bike at once. A bike with neither a make nor a model SHALL be refused with "Enter a make or a model."

#### Scenario: adding a bike
- **WHEN** staff add a Specialized Allez in Red
- **THEN** it is listed under Bikes, opening its own page

#### Scenario: nothing typed
- **WHEN** staff press Add bike with no make or model
- **THEN** the box stays open and says "Enter a make or a model."
