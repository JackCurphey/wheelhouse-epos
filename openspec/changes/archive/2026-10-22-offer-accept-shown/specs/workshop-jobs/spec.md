## MODIFIED Requirements

### Requirement: The shop can offer a request another time
A booking request SHALL be able to move to a time the shop suggests, as an "offered" booking: its new time held, the time first asked for let go, until the customer accepts (it becomes confirmed), cancels, or the shop offers again, declines or lets it expire (Jack, 20 Oct). While it is offered, an edit SHALL NOT move its day, times or mechanic: staff offer again instead (Jack, 22 Oct).

#### Scenario: Offering
- **WHEN** staff offer Sam's request Friday 18 September at 12:00 with Alex
- **THEN** the booking is offered at that time, held for Sam, and Sam's first time is free for others

#### Scenario: Accepting
- **WHEN** Sam accepts the time
- **THEN** the booking is confirmed at Friday 18 September, 12:00

#### Scenario: Moving an offered booking
- **WHEN** staff try to change an offered booking's day in Change details
- **THEN** it is refused with "This time is on offer to the customer. To change it, use Offer another time."
