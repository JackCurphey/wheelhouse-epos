## ADDED Requirements

### Requirement: Staff print a bike tag once the bike is in
Once a job's bike is in the shop, the job page SHALL offer "Print bike tag". Pressing it SHALL print only the tag, on the computer's own printer. The tag SHALL show the job number, a Code 128 barcode of it, the customer and the bike.

#### Scenario: Printing the tag
- **WHEN** staff press Print bike tag on a booked-in job
- **THEN** the print box opens with only the tag: the job number, its barcode, the customer's name and the bike

#### Scenario: No tag before the bike arrives or after it leaves
- **WHEN** a job's bike is expected or has been collected
- **THEN** the job page offers no Print bike tag
