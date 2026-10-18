## ADDED Requirements

### Requirement: Unpaid finished work is paid at the till from the job page
On finished work whose order isn't paid, the job page SHALL offer "Take payment" in place of "Hand over", opening the till with the job, whose payment records the hand-over (collect and pay decision 3; Jack, 18 Oct). Finished work already paid SHALL keep "Hand over".

#### Scenario: Not paid
- **WHEN** staff open finished work whose order is unpaid
- **THEN** the page offers "Take payment", not "Hand over", and it opens the till with the job

#### Scenario: Paid
- **WHEN** the order is already paid
- **THEN** the page offers "Hand over"
