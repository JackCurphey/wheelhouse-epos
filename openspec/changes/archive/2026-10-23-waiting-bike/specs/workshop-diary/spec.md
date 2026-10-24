## MODIFIED Requirements

### Requirement: "Waiting for you" lists what customers are waiting on staff for
"Waiting for you" SHALL list, for the signed-in shop only: new online booking requests (not requests staff made themselves); customers' change requests; and bookings the customer cancelled, until someone marks them seen (never the shop's own cancellations). Items SHALL come oldest first by when each arrived. Each SHALL carry the job number, day, time and mechanic, the customer, the bike (make then model, as the diary's blocks name it, or none when the job has no bike) and the services in order; a change request SHALL also carry where the customer wants it.

#### Scenario: A new online booking
- **WHEN** Sam Reed books a Brake service online with [mechanic] at 10:00
- **THEN** it is listed as a new booking from 10:00 to 10:45 with [mechanic], for Sam Reed, with that service, arriving when the booking was made

#### Scenario: Every item carries the bike
- **WHEN** Sam Reed books online with a Specialized Sirrus, then asks to move it, or cancels it
- **THEN** the new booking, the change request and the cancellation each carry the bike "Specialized Sirrus"

#### Scenario: A booking without a bike
- **WHEN** a customer books online without choosing or adding a bike
- **THEN** the item carries no bike

#### Scenario: A change request
- **WHEN** a confirmed booking with Jo at 10:00 asks to move to 14:00 with Alex on another day
- **THEN** it is listed as a change request from 10:00–11:00 with Jo to 14:00–15:00 with Alex

#### Scenario: Oldest first
- **WHEN** a cancellation arrived on 8 September, a change request on 9 September and a new booking on 10 September
- **THEN** they are listed in that order

#### Scenario: Another shop
- **WHEN** another shop receives an online booking
- **THEN** it never appears in this shop's list
