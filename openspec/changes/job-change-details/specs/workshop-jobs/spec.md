## ADDED Requirements

### Requirement: The job page changes a job's details
The job page SHALL offer "Change details" (Jack, 18 Oct, `docs/decisions/2026-10-18-old-diary-features.md` answer 3), beside Close on a computer or tablet and in the job's details box on a phone. It SHALL open a pop-up filled in with the job title, customer, bike, date, start and end time, and the mechanic as pills ending with "Shared queue". Finished work SHALL NOT offer it.

#### Scenario: Finished work
- **WHEN** the work on a job is finished
- **THEN** its page has no "Change details"

#### Scenario: A phone
- **WHEN** staff open a job on a phone
- **THEN** "Change details" sits in the job's details box, and its pop-up fills the screen

### Requirement: Change details saves every field safely
"Save changes" SHALL send every field with the version the page saw, and the bike always (none when there is none), so a new customer never keeps the old customer's bike. A refusal SHALL show in plain words with the pop-up still open. A job over several days SHALL change its date and times in the diary, not here.

#### Scenario: Changing the end time and the mechanic
- **WHEN** staff change the Brake service's end time from 11:00 to 12:00 and its mechanic from Alex Morgan to Jo Taylor, and save
- **THEN** the save sends the title, customer, bike, date, 10:00, 12:00, Jo Taylor and the version

#### Scenario: Another customer
- **WHEN** staff change the customer to Oliver Chen, who has one bike
- **THEN** his bike is chosen, and the old customer's bike is not sent
