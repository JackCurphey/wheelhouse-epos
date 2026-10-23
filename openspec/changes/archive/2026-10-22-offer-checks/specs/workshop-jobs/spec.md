## MODIFIED Requirements
### Requirement: The shop can offer a request another time
A booking request SHALL be able to move to a time the shop suggests, as an "offered" booking: its new time held, the time first asked for let go, until the customer accepts (it becomes confirmed), cancels, or the shop offers again, declines or lets it expire (Jack, 20 Oct). While it is offered, an edit SHALL NOT move its day, times or mechanic: staff offer again instead (Jack, 22 Oct). An offer SHALL be refused when the bike is already in the shop or the work has started (the customer's link can't act then), when its time has already gone today, and when its message is not text.

#### Scenario: Offering
- **WHEN** staff offer Sam's request Friday 18 September at 12:00 with Alex
- **THEN** the booking is offered at that time, held for Sam, and Sam's first time is free for others

#### Scenario: Accepting
- **WHEN** Sam accepts the time
- **THEN** the booking is confirmed at Friday 18 September, 12:00

#### Scenario: Moving an offered booking
- **WHEN** staff try to change an offered booking's day in Change details
- **THEN** it is refused with "This time is on offer to the customer. To change it, use Offer another time."

#### Scenario: A bike already in the shop
- **WHEN** staff offer another time to a request whose bike is already in the shop
- **THEN** it is refused with "The bike is already in the shop, so this can’t be offered another time." and the request stays as it was

#### Scenario: A time gone today
- **WHEN** staff offer today at a time the shop's clock has already passed
- **THEN** it is refused with "That time has passed - please choose a later time."

#### Scenario: A message that isn't text
- **WHEN** an offer carries a message that is an object or a number
- **THEN** it is refused with "The message must be text" and nothing is stored
