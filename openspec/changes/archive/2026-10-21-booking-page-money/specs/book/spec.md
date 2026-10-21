## ADDED Requirements

### Requirement: The booking page shows the work and the money, figures only when prices show
Once the bike is in, the booking page SHALL list the work on the job. Once ready, it SHALL list what the customer declined, what's left to pay, or what was paid and when. With "Show prices on the booking page" off, every figure SHALL be hidden and the rest SHALL still show (Jack, 21 Oct, answer 4).

#### Scenario: Ready, prices shown
- **WHEN** Maya opens her link once her bike is ready
- **THEN** the page shows "To pay when you collect £111.00", then What we did with each line's price, and "Not done — you said no thanks: Replace gear cable (£12.00)"

#### Scenario: Prices hidden
- **WHEN** the shop doesn't show prices online
- **THEN** the same lines show with no figures

### Requirement: An expired link's page says which job and gives the shop
An expired link's page SHALL give the job's number and the shop's address and phone. A collected job's page SHALL say it has been collected. A booking whose bike never came in SHALL give the 30-day rule and "Book a repair".

#### Scenario: Collected long ago
- **WHEN** Maya opens her link 31 days after collecting her bike
- **THEN** it says "This link has expired" and that the job was collected, with the shop's details
