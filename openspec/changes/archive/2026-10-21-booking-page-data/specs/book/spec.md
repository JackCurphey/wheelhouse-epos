## ADDED Requirements

### Requirement: The booking link says how far the bike is, and who to contact
The booking link SHALL carry:
- how far the work is;
- when the bike was booked in and collected;
- the day the bike is expected to be ready (the job's last day);
- the shop's address, phone and opening hours.

#### Scenario: A bike in the workshop
- **WHEN** the customer opens the link after their bike is booked in and started
- **THEN** it says the work is in progress and when the bike was booked in, with the shop's address, phone and hours

### Requirement: A booking link lasts 30 days after collection
A booking link SHALL stop working 30 days after its bike was collected. A link SHALL keep working while its bike is in the shop. A link whose bike never came in SHALL stop working 30 days after its booked day. An expired link SHALL say which job it was, why it expired, and the shop's name, address and phone, with nothing that identifies the customer.

#### Scenario: Collected 31 days ago
- **WHEN** the customer opens the link of a bike collected 31 days ago
- **THEN** it is refused as expired, giving the job's number, "collected", and the shop's details

#### Scenario: Still in the shop
- **WHEN** a bike booked 40 days ago is still in the shop
- **THEN** its link still works
