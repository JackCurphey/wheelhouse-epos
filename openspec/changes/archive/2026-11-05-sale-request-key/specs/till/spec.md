## ADDED Requirements

### Requirement: A sale sent twice counts once
A sale sent again with its request key and the same details SHALL get the first answer and change nothing, whether the first answer was lost or both were sent at once. A sale refused or failed SHALL keep no key, so it can be tried again.

#### Scenario: The answer is lost
- **WHEN** a sale of one of [n] is saved, its answer is lost, and Card approved is pressed again
- **THEN** there is one sale, one stock line, and [n] − 1 in stock, and the till shows Paid

### Requirement: A sale's key with different details is refused
A sale sent with a key already used for different details SHALL be refused, saying that sale was recorded and which it is, and SHALL record nothing.

#### Scenario: The basket changed after a lost answer
- **WHEN** a sale's answer is lost, a line is added, and it's sent again with its key
- **THEN** it's refused, saying the sale was recorded, and without telling anyone to reverse a payment

### Requirement: An order's payment sent twice counts once
A payment of an order sent again with its request key and the same details SHALL get the first answer, its warning included, and move nothing. Any other payment of an order already paid SHALL say which sale paid it.

#### Scenario: A lost answer on a job
- **WHEN** a job's payment is saved, its answer is lost, and Card approved is pressed again
- **THEN** the till shows Paid and carries on as if the first answer had arrived

#### Scenario: Another till paid it
- **WHEN** another till has paid the job, and Card approved is pressed here
- **THEN** it says the job is already paid and which sale, not to take payment again, and to reverse a second card payment if one was taken
