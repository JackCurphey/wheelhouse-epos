# workshop-jobs Specification

## Purpose
A workshop job is one piece of work on one bike for a shop: who it is for,
when and by whom it is done, where the bike is, how far the work has got, and
everything attached to it. This spec says what the app does with a job today.

## Requirements

### Requirement: Every job has its own shop's reference number
Every new job SHALL be given a reference of the form WH- followed by a number. Numbers SHALL count separately for each shop, starting at WH-1000. A number SHALL never be given out twice in the same shop, even when two jobs are made at the same moment, and SHALL NOT be reused after its job is deleted, because a tag with that number may already be on a bike.

#### Scenario: A shop's first job
- **WHEN** a shop creates its first job
- **THEN** the job's reference is WH-1000

#### Scenario: Two shops count separately
- **WHEN** two different shops each create their first job
- **THEN** both jobs are WH-1000, so neither shop's customers can tell how busy the other shop is

#### Scenario: A deleted job's number stays spent
- **WHEN** a job is deleted and the shop then creates another job
- **THEN** the new job gets a different reference from the deleted one

#### Scenario: Jobs made at the same moment
- **WHEN** ten jobs in one shop are given references at the same moment
- **THEN** all ten references are different

### Requirement: Staff create a job with a title, a date and optional times
Staff SHALL be able to create a job with a title and a date, and optionally a start and end time, notes, a customer, a bike, a mechanic, a planned length and an old-app status. A job given a start time but no end time SHALL end one hour later. With no status the job SHALL start as a confirmed booking, bike expected, work not started; with a status it SHALL start as that status's states (see the old-app status requirement).

#### Scenario: Creating and reading back a job
- **WHEN** staff create a job titled "Gear cable" for a Monday, 10:00 to 11:00, with a mechanic and the note "Rear mech skipping"
- **THEN** the job is saved and reading it back gives the same title, date, mechanic and notes, with the old status "scheduled"

#### Scenario: Creating a job that is already waiting for parts
- **WHEN** staff create a job with the old-app status "waiting_parts"
- **THEN** the booking is scheduled, the bike is in the shop and the work is waiting for parts

#### Scenario: A start time with no end time
- **WHEN** staff create a job with a start time of 10:00 and no end time
- **THEN** the job ends at 11:00

#### Scenario: Missing title or date
- **WHEN** staff try to create a job with no title, or with a date not written as year-month-day
- **THEN** it is refused with "Job title is required" or "A valid date is required"

#### Scenario: Times that make no sense
- **WHEN** staff give a time not in HH:MM form, or an end time not after the start time
- **THEN** it is refused with "Start time must be in HH:MM format", "End time must be in HH:MM format" or "End time must be after start time"

#### Scenario: A planned length out of range
- **WHEN** staff give a planned length of 0 minutes, or "an hour"
- **THEN** it is refused with "The planned length must be a whole number of minutes between 1 and 720"

### Requirement: A job links only to a real customer, that customer's bike and a working mechanic
A job MAY be linked to a customer, a bike and a mechanic, each optional. The customer SHALL be an active customer, the mechanic an active staff member who is a mechanic, and the bike an active bike belonging to the job's customer. When a job's customer changes and no bike is given, a bike that no longer belongs to the customer SHALL be dropped from the job rather than the change being refused.

#### Scenario: A customer that does not exist or is inactive
- **WHEN** staff create or edit a job with a customer who is not active
- **THEN** it is refused with "Customer not found or inactive"

#### Scenario: Someone else's bike
- **WHEN** staff link a job to a bike that belongs to a different customer
- **THEN** it is refused with "That bike doesn't belong to the selected customer"

#### Scenario: A bike that is not active
- **WHEN** staff link a job to a bike that does not exist or is inactive
- **THEN** it is refused with "Bike not found or inactive"

#### Scenario: A mechanic who is not a working mechanic
- **WHEN** staff give a mechanic who is inactive or not a mechanic
- **THEN** it is refused with "Mechanic not found or inactive"

#### Scenario: Changing the customer drops the old customer's bike
- **WHEN** staff change a job's customer without saying which bike
- **THEN** the job keeps no bike that belongs to someone else, and the change is not refused

### Requirement: A job's day and time must fit the shop's rules
When staff create a job, edit it, or add or move one of its days, the day SHALL be one the shop opens and the mechanic works, a timed job SHALL fit within that day's opening hours, and it SHALL NOT overlap another live job of the same mechanic on any of that job's days. Each is refused with its own message. A job with no times is not checked against hours or overlaps.

#### Scenario: A double booking
- **WHEN** a mechanic has a job from 10:00 to 11:00 and staff book another job for the same mechanic from 10:30 to 11:30
- **THEN** it is refused with "That mechanic is already booked over part of that window - please choose another time."

#### Scenario: Outside opening hours
- **WHEN** staff book a job from 03:00 to 04:00
- **THEN** it is refused with "That job doesn't fit in the shop's opening hours ([open]–[close]) - please choose an earlier time or a shorter job type.", naming that day's hours

#### Scenario: A day the shop is closed
- **WHEN** the shop opens Monday to Friday and staff book a job on a Sunday
- **THEN** it is refused with "The shop is closed that day - please choose another date."

#### Scenario: The mechanic's day off
- **WHEN** a mechanic works Tuesday to Friday and staff book them a job on a Monday the shop is open
- **THEN** it is refused with "That mechanic does not work that day - please choose another day or another mechanic."

#### Scenario: A working day is still bookable
- **WHEN** a mechanic works Monday to Friday and staff book them a job on a Monday
- **THEN** the job is created

### Requirement: Every new job comes with an order unless staff say otherwise
Creating a job SHALL also create an order linked to it, so its work and parts can be charged. Staff MAY ask for no order, for a shop that takes payment somewhere else. A job SHALL show its order's number, status and total.

#### Scenario: A job is created with its order
- **WHEN** staff create a job
- **THEN** exactly one order is linked to it and the job shows that order

#### Scenario: A job with no order
- **WHEN** staff create a job and ask for no order
- **THEN** the job is created with no order linked

### Requirement: Staff can read one job and list jobs by date
Staff SHALL be able to read one job, with its reference, its booking, bike and work states, its version, notes, the customer's own words, its linked order and its days. Staff SHALL be able to list jobs, optionally for a date range; a job SHALL be in the range when any of its days is. A job that does not exist SHALL be refused with "Job not found".

#### Scenario: A job in the range
- **WHEN** staff list jobs for the Monday a job is on
- **THEN** the list includes that job

#### Scenario: A job outside the range
- **WHEN** staff list jobs for 1 to 2 October and the job is on another day
- **THEN** the list does not include it

#### Scenario: A job that is not there
- **WHEN** staff read a job that does not exist
- **THEN** it is refused as not found with "Job not found"

### Requirement: Staff can edit a job's details
Staff SHALL be able to change a job's title, date, times, notes, customer, bike, mechanic and planned length; anything not sent SHALL stay as it was. On a job with times, the planned length SHALL be worked out from the times and any length sent SHALL be ignored. The same checks as creating a job SHALL apply. Every saved edit SHALL raise the job's version by one.

#### Scenario: A planned length on a timed job
- **WHEN** staff send a planned length with an edit to a job that runs 10:00 to 11:00
- **THEN** the job's planned length is 60 minutes

#### Scenario: Changing the notes
- **WHEN** staff save the note "Rang the customer" on a job
- **THEN** the job's notes read "Rang the customer" and its version has gone up by one

#### Scenario: A cancelled job can still be edited
- **WHEN** staff rename a job whose booking was cancelled
- **THEN** the change is saved

### Requirement: Finished work is frozen against edits
When a job's work is finished, staff SHALL NOT be able to change its title, date, times, notes, customer, bike or mechanic. Changing its old-app status SHALL stay open, because that is how the old app reopens a job; reopening this way SHALL set the work to not started. The freeze SHALL NOT cover the job's later days, its files, or making a new private link.

#### Scenario: Editing a finished job
- **WHEN** staff try to change the title or the notes of a job whose work is finished
- **THEN** it is refused with "This job is complete - reopen it before making changes."

#### Scenario: Reopening a finished job from the old app
- **WHEN** staff set a finished job's old-app status back to "scheduled"
- **THEN** the job reads as "scheduled" when read back, with the work not started

#### Scenario: Adding a day to a finished job
- **WHEN** staff add another day to a job whose work is finished
- **THEN** it is not refused for being finished

### Requirement: Staff can delete a job
Staff SHALL be able to delete a job in any state, without sending a version. Its order SHALL be kept, no longer linked to any job, so nothing already added to it is lost. Its attached files SHALL be removed with it. Deleting a job that does not exist SHALL be refused as not found.

#### Scenario: Deleting a job keeps its order
- **WHEN** staff delete a job that has an order
- **THEN** the job can no longer be read, and the order still exists with no job linked

#### Scenario: Deleting a job that is not there
- **WHEN** staff delete a job that does not exist
- **THEN** it is refused as not found

### Requirement: A job records three separate facts: the booking, the bike and the work
A job SHALL keep three separate facts, each with its own fixed set of values: the booking (pending, scheduled, reschedule requested, declined, expired, cancelled), where the bike is (expected, in the shop, collected) and the work (not started, in progress, waiting for parts, on hold, finished). Moving one SHALL NOT move another. The database SHALL refuse any value not in these sets.

#### Scenario: Finishing the work does not collect the bike
- **WHEN** a bike is booked in, its work started and then finished
- **THEN** the work is finished and the bike is still in the shop

#### Scenario: A bike can leave before the work is finished
- **WHEN** a bike is booked in, its work started, and the customer collects it
- **THEN** the bike is collected and the work is still in progress

#### Scenario: A value no set allows
- **WHEN** anything tries to store a state that is not in its set
- **THEN** the database refuses it

### Requirement: Staff move a booking with accept, decline, request reschedule, cancel and expire
Staff SHALL be able to: accept a pending booking or a reschedule request (it becomes scheduled); decline a pending booking (declined) or a reschedule request (back to scheduled); ask to reschedule a scheduled booking; cancel a pending, scheduled or reschedule-requested booking; and mark a pending booking expired. Through these actions, declined, expired and cancelled are final; the old app's save can still reopen them (see the old-app status requirement).

#### Scenario: Accepting a booking request
- **WHEN** staff accept a pending booking
- **THEN** it becomes scheduled and its version goes up by one

#### Scenario: Declining a reschedule request
- **WHEN** staff ask to reschedule a scheduled job and then decline that request
- **THEN** the booking is scheduled again

#### Scenario: A declined booking is final
- **WHEN** staff decline a pending booking and then try to accept it
- **THEN** the accept is refused

#### Scenario: A cancelled job is kept
- **WHEN** staff cancel a scheduled job
- **THEN** the booking is cancelled and the job can still be read

### Requirement: Plain accept and decline refuse a customer's change request
When a customer has asked to change their booking and the request is waiting, the plain accept and decline actions SHALL refuse, because answering a change request has its own actions.

#### Scenario: Accepting a booking with a change request waiting
- **WHEN** staff use plain accept or decline on a booking whose customer has asked for a change
- **THEN** it is refused with "This booking has a change request from the customer - accept or decline the change instead" and the code "illegal"

### Requirement: A staff cancellation is recorded as the shop's
When staff cancel a booking, the job SHALL record that the shop cancelled it and when.

#### Scenario: Staff cancel an online booking
- **WHEN** staff cancel a booking the customer made online
- **THEN** the job shows it was cancelled by staff, with the time

### Requirement: Staff move the bike with book in, collect and reopen
Staff SHALL be able to book an expected bike in, mark a bike in the shop as collected, and bring a collected bike back into the shop. Bringing a bike back SHALL leave the work as it was. These moves SHALL NOT depend on the booking: a bike on a cancelled booking can still be booked in.

#### Scenario: Booking in a bike on a cancelled booking
- **WHEN** staff book in the bike for a job whose booking was cancelled
- **THEN** the bike is in the shop

#### Scenario: Collecting a bike that was never booked in
- **WHEN** staff try to collect a bike that is still expected
- **THEN** it is refused, with a message starting "cannot collect a job that is expected"

#### Scenario: A collected bike comes back
- **WHEN** a finished, collected bike is brought back into the shop
- **THEN** the bike is in the shop and the work is still finished

### Requirement: Staff move the work with start, waiting for parts, parts arrived, hold, resume, finish and reopen
Staff SHALL be able to: start work not yet started; put work in progress waiting for parts; mark parts arrived (back in progress); put work on hold from not started, in progress or waiting for parts; resume work on hold (back in progress); finish work in progress; and reopen finished work (back in progress). The work moves SHALL NOT depend on where the bike is or on the booking.

#### Scenario: Starting work before the bike is in
- **WHEN** staff start work on a job whose bike is still expected, or whose booking was cancelled
- **THEN** the work is in progress

#### Scenario: Waiting for parts
- **WHEN** staff start a job's work and then mark it waiting for parts
- **THEN** the work is waiting for parts

#### Scenario: Hold and resume
- **WHEN** staff start a job's work, put it on hold, and resume it
- **THEN** the work is on hold after the hold and in progress after the resume

#### Scenario: Resuming work that is not on hold
- **WHEN** staff try to resume work that has not started
- **THEN** it is refused, with a message starting "cannot resume a job that is not_started"

#### Scenario: Finishing work that never started
- **WHEN** staff try to finish work that has not started
- **THEN** it is refused, the message names "start" as the way on, and nothing changes

### Requirement: A refused move says why and what can be done instead
A move the job's current state does not allow SHALL be refused as a conflict with the code "illegal" and the message "cannot [move] a job that is [state]; from here you can [moves]", listing the moves allowed from that state, or "do nothing". The job and its version SHALL be left unchanged. This check SHALL come before the version check, so a move that is both not allowed and from an out-of-date screen is refused as "illegal".

#### Scenario: Not allowed and out of date
- **WHEN** staff send a move the job's state does not allow, with an old version
- **THEN** it is refused with the code "illegal", not "stale"

#### Scenario: Accepting a job that is already scheduled
- **WHEN** staff accept a booking that is already scheduled
- **THEN** it is refused as a conflict with the code "illegal" and a message containing "cannot accept a job that is scheduled"

### Requirement: Every move needs the version the screen last saw
Every staff action that moves a job, and every change to a job's days, SHALL require the job's version as last read. Without it the action SHALL be refused with "version is required - send the version you last read". If the job has changed since, it SHALL be refused as a conflict with the code "stale" and "This job changed while you were looking at it. Reload and try again." A move that succeeds SHALL raise the version by one, and so SHALL a carry-over day.

#### Scenario: No version sent
- **WHEN** staff accept a booking without saying which version they saw
- **THEN** it is refused with "version is required - send the version you last read"

#### Scenario: Two people at two screens
- **WHEN** one person accepts a pending booking and another, still holding the earlier version, then tries to cancel it
- **THEN** the cancel is refused with the code "stale" and a message containing "changed while you were looking at it"

### Requirement: The old app's save takes part in the version check
A save of a job's details MAY carry the version last read. If it does, it SHALL be a whole number, and an out-of-date version SHALL be refused with the code "stale" and change nothing. A save without a version SHALL still go ahead. Either way the save SHALL raise the version, so an action sent with the version read before the save is refused as stale.

#### Scenario: A save from an out-of-date screen
- **WHEN** staff save notes with a version older than the job's
- **THEN** it is refused with "This job changed while you were looking at it. Reload and try again." and the code "stale", and the notes and version are unchanged

#### Scenario: An action after someone else's save
- **WHEN** staff read a job, someone moves its time, and the first person then accepts it with the version they read
- **THEN** the accept is refused with the code "stale"

#### Scenario: A version that is not a number
- **WHEN** a save sends the version "one"
- **THEN** it is refused

### Requirement: Another shop's jobs are invisible
A shop SHALL NOT be able to see, move, or touch another shop's job, its attachments or its customer link. Such a job SHALL be treated as not found, not as forbidden.

#### Scenario: Acting on another shop's job
- **WHEN** staff of one shop try to accept a booking belonging to another shop
- **THEN** it is refused as not found, and the job is unchanged

### Requirement: Paying for a job's order finishes the work only when finishing is allowed
When a job's linked order is paid at the till, the job's work SHALL be finished as part of the same act. If the work is already finished, the payment SHALL go through and the job SHALL be left as it is. If the work cannot be finished from its current state, the payment SHALL be refused before any sale is made, with the code "illegal" and the same "cannot finish a job that is [state]; from here you can [moves]" message.

#### Scenario: Paying for work in progress
- **WHEN** a job's work is in progress and its order is paid
- **THEN** the sale is made and the job's work is finished

#### Scenario: Paying for work that never started
- **WHEN** a job's work has not started and its order is paid
- **THEN** the payment is refused with a message containing "cannot finish a job that is not_started", and no sale is made

#### Scenario: Paying for work on hold
- **WHEN** a job's work is on hold and its order is paid
- **THEN** the payment is refused with a message naming "resume"; after staff resume the work, the same payment goes through

#### Scenario: Paying for work already finished
- **WHEN** a job's work is already finished ("Mark ready for collection") and its order is paid
- **THEN** the sale is made, the job's work stays finished, and the job is not changed again

#### Scenario: The job moves while the payment is going through
- **WHEN** the work could be finished when the payment was checked, but someone moved the job before it was finished
- **THEN** the sale stands, the job is not moved, and the reply carries a warning saying why

### Requirement: A job can be worked over several days
A job SHALL have one or more days, in order. Day 1 SHALL always be the job's own date, times and mechanic, and SHALL move when the job moves. Each later day SHALL have its own date, times and mechanic. Every day SHALL count as that mechanic's time when checking for double bookings.

#### Scenario: A one-day job
- **WHEN** staff create a job for Sam on 6 October, 10:00 to 12:00
- **THEN** the job has one day: day 1, 6 October, 10:00–12:00, Sam

#### Scenario: Booking over a job's second day
- **WHEN** a job for Sam has a second day on 27 October, 10:00 to 12:00, and staff book Sam another job at 11:00 that day
- **THEN** it is refused as already booked

### Requirement: Staff can add another day to a job
Staff SHALL be able to add a day after a job's last day. It SHALL go on the next day the shop opens and the last day's mechanic works, at the same times with the same mechanic, and the usual day-and-time rules SHALL apply. If there is no such day within 60 days, it SHALL be refused with "There is no working day for this mechanic in the next 60 days".

#### Scenario: Skipping the mechanic's day off
- **WHEN** Sam does not work Wednesdays and staff add another day to Sam's job on Tuesday 13 October, 10:00 to 12:00
- **THEN** day 2 is Thursday 15 October, 10:00–12:00, Sam, and the version goes up by one

#### Scenario: Adding a day from an out-of-date screen
- **WHEN** staff add a day with an old version, or with no version
- **THEN** it is refused as stale, or as missing the version

### Requirement: Staff can move or remove a later day
Staff SHALL be able to move a later day to another date, time and mechanic, under the usual day-and-time rules, and remove a later day, after which the days after it close up. Day 1 SHALL NOT be moved or removed this way.

#### Scenario: Moving day 2 to another mechanic
- **WHEN** staff move day 2 of a job to 11 November, 14:00 to 16:00, with Jo
- **THEN** day 2 reads 11 November, 14:00–16:00, Jo, and day 1 is unchanged

#### Scenario: Moving a day onto a clash
- **WHEN** staff move a later day onto a time when that mechanic already has a job
- **THEN** it is refused

#### Scenario: Removing a middle day
- **WHEN** a job has three days and staff remove day 2
- **THEN** the job has days 1 and 2, and the new day 2 is the old day 3's date

#### Scenario: Day 1 cannot be removed or moved on its own
- **WHEN** staff try to remove or move day 1 through the days
- **THEN** it is refused with "A job's first day can't be removed" or "Move a job's first day by moving the job itself"

### Requirement: Unfinished work carries over to the next working day
When jobs are listed, a job whose bike is in the shop, whose work is not finished, whose booking is scheduled or has a reschedule request, and whose last day has passed SHALL get a new day on the next day from today that the shop opens and the mechanic works, at the same times with the same mechanic. It SHALL happen once, SHALL raise the job's version, and SHALL NOT be refused for overlapping another job.

#### Scenario: A job left over from last week
- **WHEN** today is Tuesday 1 September, a booked-in job for Sam was on Friday 28 August, 13:00 to 15:00, and the jobs are listed
- **THEN** the job gains day 2 on 1 September, 13:00–15:00, Sam, and listing again does not add a third day

#### Scenario: Jobs that do not carry over
- **WHEN** a past job's bike never came in, or a past job's work is finished, and the jobs are listed
- **THEN** neither job gains a day

### Requirement: Staff can attach files to a job
Staff SHALL be able to attach a file to a job, such as an e-bike's diagnostic report, keeping its name and type. A file SHALL be refused if it is missing, empty or over 15MB. Only the old app offers this; the new staff screens do not yet.

#### Scenario: Attaching a report
- **WHEN** staff attach "report.pdf" to a job
- **THEN** it is saved with that name and its size

#### Scenario: No file, an empty file, or a huge one
- **WHEN** staff send no file, an empty file, or a file over 15MB
- **THEN** it is refused with "No file data received", "That file is empty" or "That file is too large (max 15MB).", and nothing is saved

### Requirement: Staff can list, download and delete a job's files
Staff SHALL be able to list a job's files, newest first, and download each one exactly as uploaded, under its own name even when the name has accented letters. Downloads SHALL NOT be cached. Deleting a file SHALL remove it completely. A file that is not there SHALL be refused with "Attachment not found".

#### Scenario: Downloading a file
- **WHEN** staff download a file they attached
- **THEN** they get back exactly the same bytes, named as uploaded

#### Scenario: Deleting a file
- **WHEN** staff delete a job's file
- **THEN** it no longer appears in the list and is gone from storage

### Requirement: Staff can make a new private link for a job's customer
Staff SHALL be able to make a private link to a job for its customer, to text or read out. Making a new link SHALL stop the job's old link working at once. A job with no customer SHALL be refused with "This job has no customer to send a link to". Making a link SHALL need a staff sign-in. The shop SHALL keep only a scrambled copy of the link's code. No staff screen offers this yet.

#### Scenario: A new link replaces the old one
- **WHEN** staff make a new link for a booked job
- **THEN** the new link opens the booking and the old link no longer does

#### Scenario: A job with no customer
- **WHEN** staff make a link for a job with no customer
- **THEN** it is refused

#### Scenario: Not signed in
- **WHEN** someone not signed in as staff tries to make a link
- **THEN** it is refused as not signed in

### Requirement: The old app still sees one of its five statuses
For screens not yet replaced, every job SHALL also show one of five old statuses, worked out from the booking and the work and never stored by hand: a cancelled, declined or expired booking, or finished work, reads "complete"; otherwise waiting for parts reads "waiting_parts", on hold "on_hold", a pending booking "pending", and anything else "scheduled". Where the bike is SHALL NOT affect it.

#### Scenario: A cancelled booking
- **WHEN** a booking is cancelled, declined or expires
- **THEN** its old status reads "complete"

#### Scenario: The old status follows the moves
- **WHEN** a pending booking is accepted, or work is put waiting for parts
- **THEN** the old status reads "scheduled", or "waiting_parts"

#### Scenario: Only five values
- **WHEN** any combination of booking, bike and work states is worked out
- **THEN** the old status is one of pending, scheduled, waiting_parts, on_hold, complete

### Requirement: The old app can still set a job's status on create and save
Creating or saving a job MAY carry an old status, which SHALL be set directly without the move rules: pending → pending booking, work not started; scheduled → scheduled, not started; waiting_parts → scheduled, waiting for parts; on_hold → scheduled, on hold; complete → scheduled, finished. A save whose status matches the status the job already reads SHALL change none of the job's states. A save SHALL leave the bike alone; a create with waiting_parts or on_hold SHALL put it in the shop.

#### Scenario: A cancelled booking saved as scheduled
- **WHEN** staff save a cancelled job with the old status "scheduled"
- **THEN** the booking is scheduled again

#### Scenario: Saving work in progress from the old form
- **WHEN** a job's work is in progress and staff save it from the old form, which sends the status "scheduled" it already reads
- **THEN** the work stays in progress and the other changes are saved

#### Scenario: Changing the status from the old form
- **WHEN** a job's work is in progress and staff save it with the status "on_hold"
- **THEN** the work is on hold

#### Scenario: An unknown status
- **WHEN** a create or save sends a status that is not one of the five
- **THEN** it is refused with "status must be one of: pending, scheduled, waiting_parts, on_hold, complete"

### Requirement: The job page opens from the diary and shows where the job is
Clicking a job in the diary, or pressing Enter on it, SHALL open the job page over the diary. It SHALL show the title, a status word, the customer's name, phone and email, the bike, "Mechanic: [name]", "Ready by [day]", the total, the WH number, "Created [day]", the customer's own words, the notes, and the work and parts. The status word SHALL be one of: Booking request, Collected, Finished, Waiting for parts, Quoting, On hold, In the workshop, Expected.

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

### Requirement: The job page offers the next step as a button
The job page SHALL show the button for the job's next step: Book in (bike expected), Start work (in the shop, not started), Mark ready for collection and Waiting for parts (in progress), Parts arrived (waiting for parts), Resume (on hold), Hand over (finished, bike here). It SHALL show none for a collected bike or a pending, cancelled, declined or expired booking. Each button SHALL send the version the page saw.

#### Scenario: Booking in from the job page
- **WHEN** staff press "Book in" on a job whose bike is expected
- **THEN** the page asks the shop to book the bike in, sending the version it saw

#### Scenario: A collected bike
- **WHEN** a job's bike has been collected
- **THEN** there is no Book in, Start work, Hand over or Mark ready for collection button

#### Scenario: Someone else moved the job first
- **WHEN** staff press a stage button and the shop refuses it as stale
- **THEN** the page says "This job changed while you were looking at it." and reloads the job

### Requirement: The job page has one notes box and a "Bike is here" switch
The notes SHALL be one plain box, saved only when staff press Save notes after changing it, which confirms with "Notes saved." "Bike is here" SHALL be a switch that is off while the bike is expected, books the bike in when turned on, stays on and fixed once the bike is in, and cannot be turned on for a booking request still to be answered. If the shop refuses a notes save for another reason, the page SHALL show the shop's words.

#### Scenario: Notes on finished work
- **WHEN** staff type in the notes box of a job whose work is finished and press Save notes
- **THEN** the page shows "This job is complete - reopen it before making changes."

#### Scenario: Saving notes
- **WHEN** staff change the notes and press Save notes
- **THEN** the notes are saved with the version the page saw and the page says "Notes saved."

#### Scenario: Notes from an out-of-date page
- **WHEN** the save is refused as stale
- **THEN** the page says "This job changed while you were looking at it. Your words are still in the box." and keeps what was typed

#### Scenario: Turning on "Bike is here"
- **WHEN** staff turn on "Bike is here" for an expected bike
- **THEN** the bike is booked in

### Requirement: The job page lists and changes the job's work and parts
The job page SHALL list the lines on the job's order, labour above parts. Staff SHALL be able to add a product or service by searching or scanning a barcode, change a part's quantity, and remove a line. An order that is no longer open (paid or cancelled) SHALL be read-only here, and a job with no order SHALL say "This job has no order to add work and parts to." If the shop refuses a change, the page SHALL show the shop's reason.

#### Scenario: Labour first
- **WHEN** a job's order has brake pads and a Standard service
- **THEN** Standard service is listed above Brake pads (pair)

#### Scenario: Adding by search or scan
- **WHEN** staff search "brake" and pick Brake pads (pair), or scan its barcode
- **THEN** the product is added to the job's order with quantity 1

#### Scenario: An order no longer open
- **WHEN** the job's order is no longer open
- **THEN** there is no Add item or Remove button

#### Scenario: A refused change
- **WHEN** the shop refuses a change to the job's order
- **THEN** the page shows the shop's words, for example "This order is already converted" for an order that has been paid

### Requirement: The job page lists the days and can add or remove one
A one-day job's page SHALL show "[day], [times]" or "[day], no set time". A job with more than one day SHALL list its days as "Day [n]: [date], [times], [mechanic]", with a "Remove" button (named "Remove day [n]") on every day except day 1. "Ready by" SHALL be the last day. "Add another day" SHALL be offered unless the bike has been collected.

#### Scenario: A collected bike
- **WHEN** a job's bike has been collected
- **THEN** there is no "Add another day" button

#### Scenario: A two-day job
- **WHEN** staff open a Frame rebuild job on Mon 5 Oct and Tue 6 Oct, 10:00–12:00, with Alex Morgan
- **THEN** the page lists "Day 1: Mon 5 Oct, 10:00–12:00, Alex Morgan" and "Day 2: Tue 6 Oct, 10:00–12:00, Alex Morgan", and shows "Ready by Tue 6 Oct"

#### Scenario: Removing a day
- **WHEN** staff look for a way to remove day 1, and press "Remove day 2"
- **THEN** there is no "Remove day 1", and day 2 is removed with the version the page saw
