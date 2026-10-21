## MODIFIED Requirements

### Requirement: A booking confirmed straight away is marked New, booked online
A booking confirmed automatically SHALL sit in the diary as a normal booking, marked "New, booked online" until someone opens it; it SHALL NOT be listed in Waiting for you (Jack, 19 Oct, answer 1). The mark SHALL also show on a stack's front card when any job in the stack is new, on that job's tile when the stack fans out, and on its chip in the month view, where the chip shows the globe only; each one's name for screen readers SHALL say "new, booked online" for that job.

#### Scenario: Seen once opened
- **WHEN** a booking arrives confirmed and Jo opens the job
- **THEN** the diary no longer marks it as new

#### Scenario: A new booking in a stack
- **WHEN** a new online booking for a Specialized Sirrus starts at the same time as another job
- **THEN** the stack's front card shows New online, and its name says the Sirrus's puncture repair is new, booked online

#### Scenario: A new booking in the month view
- **WHEN** the diary shows the month with a new online booking at 10:00
- **THEN** its chip shows the globe after the bike, and its name ends "new, booked online"
