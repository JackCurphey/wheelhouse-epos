## MODIFIED Requirements

### Requirement: The customer answers an offered time on the booking page
When the shop has suggested another time, the customer's booking page SHALL say what the shop can't do, the time it suggests and its message, with "Accept this time" and "Cancel my request" (Jack, 1 Oct, decision 12; 20 Oct). Accepting SHALL confirm only the time the page showed: if the shop has changed it since, the page SHALL say "The shop has changed the time it’s offering. Here’s the new one." and show the new time (Jack, 22 Oct).

#### Scenario: Accepting the offer
- **WHEN** Sam presses Accept this time
- **THEN** the booking is confirmed for the suggested time

#### Scenario: The shop changed the time meanwhile
- **WHEN** Sam's page shows Friday at 12:00, the shop offers Monday at 09:00 instead, and Sam presses Accept this time
- **THEN** nothing is confirmed, and the page says the shop has changed the time and shows Monday at 09:00
