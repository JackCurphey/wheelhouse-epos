## ADDED Requirements

### Requirement: A product's price and cost are whole pence
Every product SHALL have its price and cost in whole pence, exactly equal to its price and cost in pounds, however that price or cost was written, by any part of the app, old or new.

#### Scenario: The brake pads
- **WHEN** Shimano brake pads are priced at £28.00
- **THEN** their price is 2800 pence

#### Scenario: A price that floating point gets wrong
- **WHEN** a product is priced at £19.99, £4.35 or £1.15
- **THEN** its price is 1999, 435 or 115 pence, never a penny out

#### Scenario: The old app saves a price
- **WHEN** the old app saves a product with a price of £[price]
- **THEN** its price in pence changes with it, and the old till still sells it at £[price]

### Requirement: A price or cost can be saved in whole pence
A product SHALL be able to be added or saved with a price or cost in whole pence. A figure that isn't a whole number from 0 to 9,999,999,999 SHALL be refused, and a refused save SHALL store nothing. A price in pence SHALL win over a price in pounds sent with it.

#### Scenario: Saving a price
- **WHEN** a product is saved with a price of 2800 pence
- **THEN** its price is £28.00 on every screen

#### Scenario: A fraction of a penny
- **WHEN** a product is saved with a price of 28.5 pence and a new description
- **THEN** the save is refused, and neither changes

### Requirement: A cost in pence follows the cost rules
A cost in pence SHALL go only to someone who can see costs. Someone who can't see costs SHALL NOT be able to change a cost in pence, whatever they send. A save with no cost in pence, or a null or empty one, SHALL leave the stored cost as it is.

#### Scenario: Jo Taylor opens the brake pads
- **WHEN** Jo Taylor (Staff) opens Shimano brake pads
- **THEN** no cost, in pounds or pence, is in what the server sent

#### Scenario: Jo Taylor sends a cost in pence
- **WHEN** Jo Taylor saves the brake pads with a cost in pence
- **THEN** the save goes through and the stored cost stays as it was

### Requirement: A product's save never hangs on a locked product
When a product can't be saved because it's held by something else for more than a short time, the save SHALL stop waiting and say Wheelhouse is busy, storing nothing, so the shop's other requests aren't starved of connections.

#### Scenario: The brake pads are held
- **WHEN** a product's row stays locked and someone saves that product
- **THEN** they are told Wheelhouse is busy within seconds, and nothing they sent is stored
