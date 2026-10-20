## ADDED Requirements

### Requirement: New job can add the customer's bike
New job SHALL offer "+ Add a bike" once a customer is chosen, opening Make, Model, Colour and Serial number, and Add bike SHALL save the bike to the customer and choose it for the job (drawn on new-job; not-drawn pages row 22, answer C).

#### Scenario: A walk-in's new bike
- **WHEN** staff choose the customer, press + Add a bike, fill in a make or model and press Add bike
- **THEN** the bike is added to the customer and chosen in Bike

#### Scenario: Nothing to name it
- **WHEN** staff press Add bike with no make and no model
- **THEN** it says "Enter a make or a model." and adds nothing
