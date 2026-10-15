## MODIFIED Requirements

### Requirement: The job page opens from the diary and shows where the job is
Clicking a job in the diary, or pressing Enter on it, SHALL open the job page over the diary. It SHALL show the title, a status word, the customer's name, phone and email, the bike, "Mechanic: [name]", "Ready by [day]", the total, the WH number, "Created [day]", the customer's own words, the notes, and the work and parts. The status word SHALL be one of: Booking request, Change requested, Cancelled, Declined, Expired, Collected, Finished, Waiting for parts, Quoting, On hold, In the workshop, Expected. A booking that a customer has asked to change, with the time they asked for, SHALL read "Change requested", in the diary's amber; a cancelled, declined or expired booking SHALL read "Cancelled", "Declined" or "Expired", in its grey (Jack, 15 Oct).

#### Scenario: No customer, no mechanic, nothing charged yet
- **WHEN** a job has no customer, no mechanic and an order total of £0.00
- **THEN** the page shows "No customer" and "Mechanic: Shared queue", and no total

#### Scenario: Opening a job
- **WHEN** staff click Maya Patel's "Standard service" job for a Trek Domane AL 3, with Alex Morgan, on Thu 8 Oct
- **THEN** the page shows "Standard service", "Expected", "07700 900142", "Trek Domane AL 3", "Mechanic: Alex Morgan", "Ready by Thu 8 Oct" and "WH-1042"

#### Scenario: Status words at each stage
- **WHEN** the bike is in the shop; or waiting for parts; or finished; or collected
- **THEN** the status reads "In the workshop"; "Waiting for parts"; "Finished"; "Collected"

#### Scenario: Waiting for parts beats a quote out
- **WHEN** the work is waiting for parts and a quote has been sent
- **THEN** the status reads "Waiting for parts"

#### Scenario: Bookings that ended or wait on a change
- **WHEN** a booking was cancelled; declined; expired; or its customer asked to change it
- **THEN** the status reads "Cancelled"; "Declined"; "Expired"; "Change requested"

### Requirement: The job page offers the next step as a button
The job page SHALL show the button for the job's next step: Book in (bike expected), Start work (in the shop, not started), Mark ready for collection and Waiting for parts (in progress), Parts arrived (waiting for parts), Resume (on hold), Hand over (finished, bike here). Beside it, a quieter "Put on hold" SHALL show while the bike is expected or the work is not started, in progress or waiting for parts (Jack, 15 Oct). It SHALL show none for a collected bike or a pending, cancelled, declined or expired booking. Each button SHALL send the version the page saw. A refused move SHALL be explained in plain words from where the job now is, such as "The bike is already here."; only a stale refusal SHALL say "This job changed while you were looking at it." Either way the page SHALL reload the job.

#### Scenario: Booking in from the job page
- **WHEN** staff press "Book in" on a job whose bike is expected
- **THEN** the page asks the shop to book the bike in, sending the version it saw

#### Scenario: Putting a job on hold
- **WHEN** staff press "Put on hold" on a job whose work is in progress
- **THEN** the page asks the shop to put the work on hold, sending the version it saw

#### Scenario: A collected bike
- **WHEN** a job's bike has been collected
- **THEN** there is no Book in, Start work, Hand over, Mark ready for collection or Put on hold button

#### Scenario: Someone else moved the job first
- **WHEN** staff press a stage button and the shop refuses it as stale
- **THEN** the page says "This job changed while you were looking at it." and reloads the job

#### Scenario: A move the job can no longer make
- **WHEN** staff press "Book in" and the shop refuses it because the bike is already in the shop
- **THEN** the page says "The bike is already here." and reloads the job

### Requirement: The job page has one notes box and a "Bike is here" switch
The notes SHALL be one plain box, saved only when staff press Save notes after changing it, which confirms with "Notes saved." On finished work the box SHALL be read-only, with "Reopen the job to change its notes." and no Save notes (Jack, 15 Oct). "Bike is here" SHALL be a switch that is off while the bike is expected, books the bike in when turned on, stays on and fixed once the bike is in, and cannot be turned on for a booking request still to be answered, or for a cancelled, declined or expired booking, which also offers no Add another day. Notes typed but not saved before the work is finished SHALL NOT stay in the read-only box. If the shop refuses a notes save for another reason, the page SHALL show the shop's words.

#### Scenario: Notes on finished work
- **WHEN** a job's work is finished
- **THEN** its notes box can't be typed in, reads "Reopen the job to change its notes." and has no Save notes

#### Scenario: Saving notes
- **WHEN** staff change the notes and press Save notes
- **THEN** the notes are saved with the version the page saw and the page says "Notes saved."

#### Scenario: Notes from an out-of-date page
- **WHEN** the save is refused as stale
- **THEN** the page says "This job changed while you were looking at it. Your words are still in the box." and keeps what was typed

#### Scenario: Turning on "Bike is here"
- **WHEN** staff turn on "Bike is here" for an expected bike
- **THEN** the bike is booked in

## ADDED Requirements

### Requirement: The job page's quote refusals are in plain words
When the shop refuses a quote action because of the quote's state, including an answer the customer has already given, the job page SHALL say why in plain words from that state, such as "This quote has been sent. Withdraw it before changing it.", not the shop's internal words (Jack, 15 Oct).

#### Scenario: Revising a sent quote
- **WHEN** the shop refuses to revise a quote because it has been sent
- **THEN** the page says "This quote has been sent. Withdraw it before changing it."
