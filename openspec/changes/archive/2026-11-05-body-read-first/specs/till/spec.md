# Spec Delta

## ADDED Requirements

### Requirement: Slow or stalled senders never hold up the shops
The server SHALL have the whole of a request's body before that request uses the shared database connections, so that clients who send part of a request and go quiet, or send it a byte at a time, can't stop any shop from being answered.

#### Scenario: 50 clients go quiet part-way through sending
- **WHEN** 50 clients with no sign-in each send part of a booking and go quiet, or send one byte at a time
- **THEN** another shop's staff, a till and the health check are all answered as normal

#### Scenario: A till's sync stalls
- **WHEN** a till's connection stalls part-way through a sync
- **THEN** other tills and staff are answered as normal

### Requirement: A request has a time limit for arriving
A request SHALL be told it took too long, and its connection closed, if the whole of it hasn't arrived in 30 seconds, or in 4 minutes for a file or photo being uploaded, however slowly it is still arriving. A request that arrives inside its time limit SHALL be handled as normal, however slowly it came.

#### Scenario: A slow file still arrives
- **WHEN** an owner on a slow connection sends a Citrus Lime file that takes 2 minutes to arrive
- **THEN** it is taken in as normal

#### Scenario: Too slow
- **WHEN** part of a small request has arrived and the rest hasn't after 30 seconds
- **THEN** the client is told it took too long and the connection closes

### Requirement: Being asked to try again never tells a cashier to reverse a payment
When a sale or a job's payment is answered that it took too long to arrive, or that too many came at once, the till SHALL say it is busy and to try again, and SHALL NOT say that no sale was recorded or to reverse a card payment. The till SHALL keep the sale's request key if an earlier answer was lost, so the sale can't be recorded twice.

#### Scenario: A job's payment whose answer was lost
- **WHEN** a job's payment is recorded but its answer is lost, and pressing Card approved again is told too many came at once
- **THEN** the till says to try again and not to take the card again, and trying again gets the first sale

#### Scenario: The only line removed and added back
- **WHEN** a sale's answer is lost, pressing again is told it took too long, and the cashier removes the only line, adds it back and pays
- **THEN** the same sale comes back, and no second sale is recorded

### Requirement: One caller can't take all the room
The server SHALL limit how many requests can be arriving at once, and how much of them it holds, and SHALL ask those over the limit to try again shortly. Anyone with no sign-in SHALL count by their address; staff and tills SHALL count by their shop. A request SHALL hold its place only while it is arriving. The website, staff accounts, webhooks, signed-in uploads, and the small requests of signed-in staff and tills SHALL each have their own limits, so that one can't use up another's.

#### Scenario: Too many at once from one address
- **WHEN** one address has 10 requests arriving at once and starts another
- **THEN** that one is asked to try again shortly, and the address's other requests, and everyone else, carry on as normal

#### Scenario: Customers sending at the same moment
- **WHEN** 100 customers on one address each send a whole small request at the same moment
- **THEN** none of them is asked to try again

#### Scenario: Stalled bookings and staff accounts
- **WHEN** one address has 10 bookings stalled part-way through sending
- **THEN** staff at that address can still sign up and sign out

#### Scenario: A shop's stalled uploads
- **WHEN** one shop has uploads stalled holding 150 MB between them
- **THEN** its next upload is asked to try again shortly, and every other shop carries on as normal

#### Scenario: Stalled uploads and a sale
- **WHEN** two shops have uploads stalled, up to the limit for all shops
- **THEN** every shop, those two included, can still make sales, take payments and sync its tills

#### Scenario: A made-up address
- **WHEN** a client puts a different address on each request, and the server isn't behind a proxy that sets it
- **THEN** they all count as the one address they really came from
