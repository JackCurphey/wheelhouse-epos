## ADDED Requirements

### Requirement: The job page changes a job's details
The job page SHALL offer "Change details" (Jack, 18 Oct, `docs/decisions/2026-10-18-old-diary-features.md` answer 3), beside Close on a computer or tablet and in the job's details box on a phone. It SHALL open a pop-up filled in with the job title, customer, bike, date, start and end time, and the mechanic as pills ending with "Shared queue". Finished work SHALL NOT offer it.

#### Scenario: Finished work
- **WHEN** the work on a job is finished
- **THEN** its page has no "Change details"

#### Scenario: A phone
- **WHEN** staff open a job on a phone
- **THEN** "Change details" sits in the job's details box, and its pop-up fills the screen

### Requirement: Change details saves only what changed, safely
"Save changes" SHALL send the title, date, times (empty for none) and mechanic with the version the pop-up opened with, and the customer and bike only when they change; a new customer SHALL always send the bike (none when there is none), so it never keeps the old customer's bike.

#### Scenario: Changing the end time and the mechanic
- **WHEN** staff change the Brake service's end time from 11:00 to 12:00 and its mechanic from Alex Morgan to Jo Taylor, and save
- **THEN** the save sends the title, date, 10:00, 12:00, Jo Taylor and the version, and not the unchanged customer or bike

#### Scenario: Another customer
- **WHEN** staff change the customer to Oliver Chen, who has one bike
- **THEN** his bike is chosen, and the old customer's bike is not sent

### Requirement: Change details explains a refusal and leaves several days to the diary
A refusal SHALL show in plain words with the pop-up still open; one because someone else changed the job SHALL say so and reload it. A job over several days SHALL change its date, times and later days' mechanics in the diary; here its mechanic is day 1's.

#### Scenario: Someone else changed the job
- **WHEN** a save is refused because the job changed meanwhile
- **THEN** the pop-up says "This job changed while you were looking at it. Close this and open it again to see the latest." and the job page reloads

#### Scenario: Several days
- **WHEN** staff open Change details on a job over two days
- **THEN** there are no date or time fields, the mechanic reads "Mechanic, day 1", and the save sends no date or times
