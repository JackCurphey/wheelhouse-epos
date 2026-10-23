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
A job MAY be linked to a customer, a bike and a mechanic, each optional. The customer SHALL be an active customer, the mechanic an active staff member who is a mechanic, sent as a whole number (never as text, a fraction, true or a number too big to be anyone's), and the bike an active bike belonging to the job's customer. When a job's customer changes and no bike is given, a bike that no longer belongs to the customer SHALL be dropped from the job rather than the change being refused.

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

#### Scenario: A mechanic that is not a whole number
- **WHEN** staff create or save a job with the mechanic sent as "abc", 1.5, true, a number written as text, or a number too big to be anyone
- **THEN** it is refused with "Mechanic not found or inactive", not a server error, and the job keeps its mechanic

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
Staff SHALL be able to read one job, with its reference, its booking, bike and work states, its version, notes, the customer's own words, its planned length, its linked order and its days. Staff SHALL be able to list jobs, optionally for a date range; a job SHALL be in the range when any of its days is. A job that does not exist SHALL be refused with "Job not found". A job's planned length SHALL be the minutes given when it was made (by staff, or an online booking's services' total), else the length of its times; it SHALL be empty when a job has neither.

#### Scenario: A job in the range
- **WHEN** staff list jobs for the Monday a job is on
- **THEN** the list includes that job

#### Scenario: A job outside the range
- **WHEN** staff list jobs for 1 to 2 October and the job is on another day
- **THEN** the list does not include it

#### Scenario: A job that is not there
- **WHEN** staff read a job that does not exist
- **THEN** it is refused as not found with "Job not found"

#### Scenario: A request with no set time keeps its planned length
- **WHEN** staff read a job with 90 planned minutes and no times
- **THEN** the job says 90 planned minutes, so the diary offers it as 90 minutes, not an hour

#### Scenario: A timed job's planned length is its times
- **WHEN** staff read a job they made from 14:00 to 15:30
- **THEN** its planned length is 90 minutes

#### Scenario: A job with no times and no length given has none
- **WHEN** staff read a job they made with neither times nor a planned length
- **THEN** its planned length is empty

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
When a job's work is finished, staff SHALL NOT be able to change its title, date, times, notes, customer, bike or mechanic. A job is reopened with the reopen-work action, never by saving it. The freeze SHALL NOT cover the job's later days, its files, or making a new private link.

#### Scenario: Editing a finished job
- **WHEN** staff try to change the title or the notes of a job whose work is finished
- **THEN** it is refused with "This job is complete - reopen it before making changes."

#### Scenario: Reopening a finished job
- **WHEN** staff reopen a finished job's work with the reopen-work action
- **THEN** the job reads as "scheduled" when read back, with the work in progress

#### Scenario: Adding a day to a finished job
- **WHEN** staff add another day to a job whose work is finished
- **THEN** it is not refused for being finished

### Requirement: Staff can delete a job
Staff SHALL be able to delete a job without sending a version, unless money has been paid on its order or the bike is in the shop (Jack, 18 Oct, `docs/decisions/2026-10-18-attachments-and-delete.md`). Then the delete SHALL be refused with the code `settle_first`, saying which of the two applies. Its order SHALL be kept, no longer linked to any job, so nothing already added to it is lost. Its attached files SHALL be removed with it. Any message to the customer about the job still waiting to go SHALL be stopped with it, as Undo stops one, so nothing is sent about a job that no longer exists; a message already on its way or sent SHALL be left as it is. A delete and a quote answer for the same job at the same moment SHALL each go through or be refused in plain terms, one after the other, never failing with a server error. Deleting a job that does not exist SHALL be refused as not found.

#### Scenario: Deleting a job keeps its order
- **WHEN** staff delete a job that has an order
- **THEN** the job can no longer be read, and the order still exists with no job linked

#### Scenario: Deleting a job that is not there
- **WHEN** staff delete a job that does not exist
- **THEN** it is refused as not found

#### Scenario: The bike is in the shop
- **WHEN** staff delete a job whose bike has been booked in
- **THEN** it is refused with `settle_first`, the bike in the shop, and the job remains

#### Scenario: The order is paid
- **WHEN** staff delete a job whose order has been paid
- **THEN** it is refused with `settle_first` and money paid

#### Scenario: A Bike ready still in its minute
- **WHEN** staff delete a job whose "Bike ready" message is still waiting its minute
- **THEN** the message is marked undone and is never sent

#### Scenario: A refused delete stops nothing
- **WHEN** a delete is refused with `settle_first`
- **THEN** the job's waiting messages are still waiting

#### Scenario: A quote is answered as the job is deleted
- **WHEN** a quote on a job is being answered and staff delete the job at the same moment
- **THEN** neither gets a server error: the answer goes in first and the job is then deleted with its order kept, or the job is deleted first and the answer is refused as not found

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
Staff SHALL be able to: accept a pending booking or a reschedule request (it becomes scheduled); decline a pending booking (declined) or a reschedule request (back to scheduled); ask to reschedule a scheduled booking; cancel a pending, scheduled or reschedule-requested booking; and mark a pending booking expired. Declined, expired and cancelled SHALL be final: no action or save reopens them.

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
Staff SHALL be able to book an expected bike in, mark a bike in the shop as collected, and bring a collected bike back into the shop. Bringing a bike back SHALL leave the work as it was. Booking a bike in SHALL be refused once its booking was cancelled, declined or expired (issue #190 A); a pending request MAY still be booked in, and a bike already in the shop on an ended booking MAY still be collected, because it really is there (decision 5, `docs/decisions/2026-10-15-job-page-fixes.md`).

#### Scenario: Booking in a bike on a cancelled booking
- **WHEN** staff book in the bike for a job whose booking was cancelled
- **THEN** it is refused with "This booking was cancelled, so the job can't be booked in.", and the bike is still expected

#### Scenario: A bike in the shop on an ended booking
- **WHEN** a bike is in the shop and its booking is then cancelled, and staff mark it collected
- **THEN** the bike is collected

#### Scenario: Collecting a bike that was never booked in
- **WHEN** staff try to collect a bike that is still expected
- **THEN** it is refused, with a message starting "cannot collect a job that is expected"

#### Scenario: A collected bike comes back
- **WHEN** a finished, collected bike is brought back into the shop
- **THEN** the bike is in the shop and the work is still finished

### Requirement: Staff move the work with start, waiting for parts, parts arrived, hold, resume, finish and reopen
Staff SHALL be able to: start work not yet started; put work in progress waiting for parts; mark parts arrived (back in progress); put work on hold from not started, in progress or waiting for parts; resume work on hold (back in progress); finish work in progress; and reopen finished work (back in progress). The work moves SHALL NOT depend on where the bike is. Starting, holding and reopening SHALL be refused once the booking was cancelled, declined or expired (issue #190 A), with "This booking was [state], so the job can't be [started / put on hold / reopened]."

#### Scenario: Starting work before the bike is in
- **WHEN** staff start work on a scheduled job whose bike is still expected
- **THEN** the work is in progress

#### Scenario: Starting work on a cancelled booking
- **WHEN** staff start work on a job whose booking was cancelled
- **THEN** it is refused with "This booking was cancelled, so the job can't be started.", and the work is not started

#### Scenario: Reopening finished work on an ended booking
- **WHEN** a job's work is finished and its booking ended, and staff reopen the work
- **THEN** it is refused, and the work stays finished

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
When a job's linked order is paid at the till, the job's work SHALL be finished as part of the same act. If the work is already finished, the payment SHALL go through and the job SHALL be left as it is, with a warning if it is no longer finished once the sale is made, or the job is no longer there. If the work cannot be finished from its current state, the payment SHALL be refused before any sale is made, with the code "illegal" and the same "cannot finish a job that is [state]; from here you can [moves]" message.

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

#### Scenario: Finished work is reopened while the payment is going through
- **WHEN** the work was already finished when the payment was checked, but someone reopened it before the sale was made, or just after
- **THEN** the sale stands, the job stays where they put it, and the reply carries a warning saying the work is no longer finished

#### Scenario: The job is deleted while the payment is going through
- **WHEN** the work was already finished when the payment was checked, but the job was deleted before the second check
- **THEN** the sale stands and the reply carries the warning "Job not found"

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
Staff SHALL be able to attach a file to a job, such as an e-bike's diagnostic report, keeping its name and type. A file SHALL be refused if it is missing, empty or over 15MB.

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

### Requirement: Creating a job may carry an old status; saving one may not
Creating a job MAY carry an old status, which SHALL be set directly without the move rules: pending → pending booking, work not started; scheduled → scheduled, not started; waiting_parts → scheduled, waiting for parts; on_hold → scheduled, on hold; complete → scheduled, finished. A create with waiting_parts or on_hold SHALL put the bike in the shop. A save SHALL NOT carry a status: it is refused with a message naming the job's own actions, so a save can never skip the move rules or the mechanic's sign-off. While a customer's change request is waiting, a save SHALL leave the booking and the request as they are, unless it puts the job on exactly the requested day, start and mechanic, which SHALL accept the request.

#### Scenario: Saving a job with a change request waiting
- **WHEN** a customer's change request is waiting and staff save the job without moving it to the requested time
- **THEN** the request stays waiting and the booking is unchanged

#### Scenario: Dropping a job onto the time the customer asked for
- **WHEN** a customer's change request is waiting and a save puts the job on the requested day, start and mechanic
- **THEN** the request is accepted and the booking is scheduled

#### Scenario: A cancelled booking saved as scheduled
- **WHEN** staff save a cancelled job with the status "scheduled"
- **THEN** it is refused and the booking stays cancelled

#### Scenario: Saving work in progress
- **WHEN** a job's work is in progress and staff save it with a new note
- **THEN** the work stays in progress and the note is saved

#### Scenario: Finishing by saving a status
- **WHEN** a job's work is in progress and staff save it with the status "complete"
- **THEN** it is refused, the message names finishing, and the work stays in progress with no sign-off

#### Scenario: An unknown status on create
- **WHEN** a create sends a status that is not one of the five
- **THEN** it is refused with "status must be one of: pending, scheduled, waiting_parts, on_hold, complete"

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

### Requirement: The job page lists and changes the job's work and parts
The job page SHALL list the lines on the job's order, labour above parts. Staff SHALL be able to add a product or service by searching or scanning a barcode, change a part's quantity, and remove a line. An order that is no longer open (paid or cancelled) SHALL be read-only here, and a job with no order SHALL say "This job has no order to add work and parts to." If the shop refuses a change, the page SHALL say why in plain words: "This job has been paid for, so its work and parts can't change." for a paid order, "This job's order was cancelled, so its work and parts can't change." for a cancelled one, "This job's order no longer exists." for a deleted one, "That service is no longer offered. Choose another." or "That product is no longer sold. Choose another." for one that has gone, "The work needs a description.", "The work needs a price of £0.00 or more.", "The work needs a time of at least 1 minute." or "Each part needs a quantity of 1 or more." for a line the shop can't take; and the shop's own words for any reason already in plain English (Jack, 15 Oct).

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
- **WHEN** the shop refuses a change to the job's order because it has been paid
- **THEN** the page says "This job has been paid for, so its work and parts can't change."

### Requirement: The job page lists the days and can add or remove one
A one-day job's page SHALL show "[day], [times]" or "[day], no set time". A job with more than one day SHALL list its days as "Day [n]: [date], [times], [mechanic]", with a "Remove" button (named "Remove day [n]") on every day except day 1. "Ready by" SHALL be the last day. "Add another day" SHALL be offered unless the bike has been collected. A refused add or remove SHALL say "This job changed while you were looking at it." when someone else changed the job first, "That day has already been removed." for a day that has gone, "This job no longer exists." for a deleted job, and otherwise the shop's words in plain English (Jack, 15 Oct).

#### Scenario: A collected bike
- **WHEN** a job's bike has been collected
- **THEN** there is no "Add another day" button

#### Scenario: A two-day job
- **WHEN** staff open a Frame rebuild job on Mon 5 Oct and Tue 6 Oct, 10:00–12:00, with Alex Morgan
- **THEN** the page lists "Day 1: Mon 5 Oct, 10:00–12:00, Alex Morgan" and "Day 2: Tue 6 Oct, 10:00–12:00, Alex Morgan", and shows "Ready by Tue 6 Oct"

#### Scenario: Removing a day
- **WHEN** staff look for a way to remove day 1, and press "Remove day 2"
- **THEN** there is no "Remove day 1", and day 2 is removed with the version the page saw

#### Scenario: Removing a day someone else removed
- **WHEN** staff press "Remove day 2" and the shop refuses because that day has gone
- **THEN** the page says "That day has already been removed."

### Requirement: The job page's quote refusals are in plain words
When the shop refuses a quote action because of the quote's state, including an answer the customer has already given, the job page SHALL say why in plain words from that state, such as "This quote has been sent. Withdraw it before changing it.", not the shop's internal words (Jack, 15 Oct).

#### Scenario: Revising a sent quote
- **WHEN** the shop refuses to revise a quote because it has been sent
- **THEN** the page says "This quote has been sent. Withdraw it before changing it."

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

### Requirement: Change details notes a waiting change request
When a customer's change request for a set day and time is waiting, Change details SHALL show "Change requested" at its top with "[customer] asked to move this to [day], [time]. Setting that time here accepts it; any other change leaves the request waiting in Waiting for you.", adding "with [mechanic]" when the request moves the job to another mechanic (Jack, 18 Oct). It SHALL be an addition only: the request stays in Waiting for you, answered there.

#### Scenario: A request waiting
- **WHEN** Oliver Chen has asked to move his booking to Wed 7 Oct, 14:00, and staff open Change details
- **THEN** it reads "Oliver Chen asked to move this to Wed 7 Oct, 14:00. Setting that time here accepts it; any other change leaves the request waiting in Waiting for you."

#### Scenario: To another mechanic
- **WHEN** the request also moves the booking from Alex Morgan to Jo Taylor
- **THEN** it reads "… to Wed 7 Oct, 14:00 with Jo Taylor. …"

#### Scenario: No request
- **WHEN** no change request is waiting
- **THEN** Change details shows no note

### Requirement: The change request note fits the job
A request for a drop-off day with no time SHALL show no note. On a job over several days, whose dates change in the diary, the note's second sentence SHALL read "Answer it from Waiting for you."

#### Scenario: A drop-off day with no time
- **WHEN** the customer asked for a drop-off day without a time
- **THEN** Change details shows no note

#### Scenario: Several days
- **WHEN** a job over two days has a change request waiting
- **THEN** the note reads "Oliver Chen asked to move this to Wed 7 Oct, 14:00. Answer it from Waiting for you."

### Requirement: The job page shows and adds a job's files and photos
The job page SHALL show "Files and photos" under Notes: photos as small pictures that open larger, other files by name and size, the customer's booking photos marked "From the customer". "Add file or photo" SHALL upload any file up to 15MB, refusing a larger one before sending, and "Remove" SHALL ask "Remove [file]?" first.

#### Scenario: A photo and a report
- **WHEN** a job has the customer's photo brake.jpg and a 20 KB report.pdf
- **THEN** the photo shows as a picture marked "From the customer", and the report as "report.pdf · 20 KB"

#### Scenario: Too large
- **WHEN** staff choose a file over 15MB
- **THEN** it says "That file is too large (max 15MB)." and nothing is sent

### Requirement: The job page deletes a job, or says to settle up first
"Delete job" SHALL sit small at the left of the job page's bottom bar, which SHALL always show. It SHALL ask "Delete [job]?" with "The job, its diary time and its files and photos are removed. This can't be undone.", "Keep the job" and "Delete job". While money has been paid on the order or the bike is in the shop, or the server refuses with `settle_first`, it SHALL instead show "Settle up first" with what is still open.

#### Scenario: Nothing at stake
- **WHEN** staff press Delete job on an expected booking and confirm
- **THEN** the job is deleted and its page closes

#### Scenario: Paid and in the shop
- **WHEN** the job's order is paid and its bike is in the shop
- **THEN** "Settle up first" lists "Paid on its order" and "Bike in the shop", and nothing is deleted

### Requirement: Unpaid finished work is paid at the till from the job page
On finished work whose order isn't paid, the job page SHALL offer "Take payment" in place of "Hand over", opening the till with the job, whose payment records the hand-over (collect and pay decision 3; Jack, 18 Oct). Finished work already paid SHALL keep "Hand over".

#### Scenario: Not paid
- **WHEN** staff open finished work whose order is unpaid
- **THEN** the page offers "Take payment", not "Hand over", and it opens the till with the job

#### Scenario: Paid
- **WHEN** the order is already paid
- **THEN** the page offers "Hand over"

### Requirement: Finishing the work records who signed it off
Finishing the work ("Mark ready for collection") SHALL ask "Who’s signing this off?" with the shop's mechanics as pills, the job's own mechanic picked, or nobody on a shared-queue job (Jack, 16 Oct, answers 1, 2, 6, 7). The server SHALL refuse to finish without an active mechanic, and SHALL record who signed off and when. A mechanic deleted or switched off while the job is being finished SHALL get the same refusal, never a server error, and nothing SHALL move.

#### Scenario: Alex signs off WH-1042
- **WHEN** WH-1042, Alex Morgan's job, is marked ready and Alex Morgan stays picked
- **THEN** the work is finished and the job records Alex Morgan and the time

#### Scenario: A shared-queue job
- **WHEN** a job with no mechanic is marked ready
- **THEN** nobody is picked and "Sign off and mark ready" waits until someone is

#### Scenario: No one chosen
- **WHEN** finish is sent without a mechanic
- **THEN** the server refuses with "Choose who is signing this off" and the work stays in progress

#### Scenario: The mechanic is deleted as the job is finished
- **WHEN** the Owner deletes or switches off the mechanic picked to sign off at the moment staff mark the job ready
- **THEN** the server refuses with "Choose who is signing this off", the work stays in progress and no sign-off is recorded

### Requirement: Staff see who signed a job off
The finished job page SHALL show "Signed off by [name] · [day], [time]" (answer 3, staff side).

#### Scenario: The finished page
- **WHEN** WH-1042 was signed off by Alex Morgan on Thu 17 Sep at 15:30
- **THEN** its page shows "Signed off by Alex Morgan · Thu 17 Sep, 15:30"

### Requirement: Reopening the work clears the sign-off and keeps it in the history
Reopening the work SHALL clear the job's sign-off, so finishing again asks again; the earlier sign-off SHALL stay in the job's sign-off history (answer 4).

#### Scenario: Reopened
- **WHEN** a signed-off job's work is reopened
- **THEN** the job shows no sign-off, and the history still holds the earlier one, marked cleared

### Requirement: A sign-off keeps the mechanic's name
Each sign-off SHALL keep the mechanic's name as it was when they signed, so deleting the person later still works and the job still says who signed it off (Jack, 18 Oct).

#### Scenario: Jo is deleted
- **WHEN** Jo Taylor signed off a job and is later deleted from the team
- **THEN** the delete goes through, and the job still shows "Signed off by Jo Taylor"

### Requirement: Paying for a job records its sign-off, and never refuses over it
Paying a job's order that finishes its work SHALL record the sign-off sent with the payment (answer 5). A sign-off that is no longer valid SHALL NOT refuse the payment: the work finishes unsigned and the reply warns. A payment that doesn't answer the sign-off question at all SHALL be refused with `use_till`, and nothing sold: only the old app sends none, and it never takes a job's payment (Jack, 21 Oct, `docs/decisions/2026-10-21-old-app-placeholder.md`).

#### Scenario: Signed at the till
- **WHEN** WH-1042, in progress, is paid with Alex Morgan signing off
- **THEN** the sale is made, the work is finished, and the job records Alex Morgan

#### Scenario: The mechanic was made inactive meanwhile
- **WHEN** the payment names a mechanic who is no longer active
- **THEN** the sale stands, the work is finished unsigned, and the reply warns "Paid and finished, but not signed off"

#### Scenario: No answer to the sign-off question
- **WHEN** a job's order is paid with no answer to who signed it off, its work in progress or finished
- **THEN** it is refused with `use_till`, nothing is sold, and the job is as it was

### Requirement: A shop chooses whether customers see who signed off
A shop setting, "Show who signed off to customers", SHALL start off (Jack, 16 Oct, answer 3), and SHALL be changed in Settings › Workshop › Mechanics. While it is off, customers SHALL NOT see who signed a job off. It SHALL be set only by a real true or false; anything else (the text "false", 1, null) SHALL be refused and leave it as it was.

#### Scenario: Off to start
- **WHEN** a new shop's workshop settings are read
- **THEN** "Show who signed off to customers" is off

#### Scenario: A sloppy value
- **WHEN** the setting is off and a request sends it as the text "false"
- **THEN** it is refused with "showSignOffToCustomers must be true or false" and the setting stays off

### Requirement: The booking link says who checked the job
With the setting on, the booking link of a signed-off job that is ready or collected SHALL say "Checked by [name]", the name kept with the sign-off.

#### Scenario: Ready, setting on
- **WHEN** WH-1042, signed off by Alex Morgan, is ready to collect and the setting is on
- **THEN** Maya's booking link says "Checked by Alex Morgan"

#### Scenario: Setting off
- **WHEN** the setting is off
- **THEN** the booking link names nobody

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
- **THEN** it is refused with "The bike is already in the shop, so this can't be offered another time." and the request stays as it was

#### Scenario: A time gone today
- **WHEN** staff offer today at a time the shop's clock has already passed
- **THEN** it is refused with "That time has passed - please choose a later time."

#### Scenario: A message that isn't text
- **WHEN** an offer carries a message that is an object or a number
- **THEN** it is refused with "The message must be text" and nothing is stored

### Requirement: Staff print a bike tag once the bike is in
Once a job's bike is in the shop, the job page SHALL offer "Print bike tag". Pressing it SHALL print only the tag, on the computer's own printer. The tag SHALL show the job number, a Code 128 barcode of it, the customer and the bike.

#### Scenario: Printing the tag
- **WHEN** staff press Print bike tag on a booked-in job
- **THEN** the print box opens with only the tag: the job number, its barcode, the customer's name and the bike

#### Scenario: No tag before the bike arrives or after it leaves
- **WHEN** a job's bike is expected or has been collected
- **THEN** the job page offers no Print bike tag

### Requirement: The custody moves record when the bike came in and went
Booking a bike in SHALL record when, and collecting it SHALL record when. Bringing a collected bike back SHALL clear its collection time.

#### Scenario: Collected, then brought back
- **WHEN** a bike is collected and then brought back into the shop
- **THEN** its collection time is cleared, and its booking link keeps working

### Requirement: The bike tag names the bike's colour
A job SHALL carry its bike's colour, and the printed bike tag SHALL name the bike with its colour when it has one.

#### Scenario: A green bike
- **WHEN** staff print the tag for WH-1042, Maya's green Trek Domane AL 3
- **THEN** the tag reads "Trek Domane AL 3 · green"

### Requirement: A job has its service's checklist
A job SHALL have the checklist of the first of its services that has one: the online booking's services in order, then the services on its order. A job with no such service SHALL have none, and its page SHALL show no checklist bar.

#### Scenario: A full service gets its checklist
- **WHEN** Standard service uses the Full service checklist and a job is booked for it
- **THEN** the job page shows "Full service checklist" with "0 of 10 done"

### Requirement: Staff tick a job's checklist and note any item
The job page SHALL show the checklist bar with "[n] of [n] done · [n] note(s)" and open the checklist, where staff tick each item and add a note to any item (`job-mechanic`, `job-checklist`; Workshop day 21, 39, 58). Ticks and notes SHALL be refused once the work is finished, until it is reopened.

#### Scenario: Ticking and a note
- **WHEN** a mechanic ticks Frame & fork and writes "The rear pads are worn." on Brakes bled & adjusted
- **THEN** the bar reads "1 of 10 done · 1 note"

#### Scenario: Finished work is frozen
- **WHEN** the work is finished and someone ticks an item
- **THEN** it is refused until the work is reopened

### Requirement: A job keeps the checklist it began with
The first tick or note SHALL copy the checklist onto the job, so a later change in Settings leaves that job's checklist as it was.

#### Scenario: Settings change after the first tick
- **WHEN** a job's checklist has a tick, and the Owner then removes an item in Settings
- **THEN** the job still has all ten items

### Requirement: New job remembers its service
A job made with New job SHALL record the service chosen, as an online booking records its services, so its checklist can be found.

#### Scenario: A staff job with a service
- **WHEN** staff make a job for Standard service, which uses the Full service checklist
- **THEN** the job has the Full service checklist

### Requirement: A bike's slot is chosen at book-in and cleared at collection
When the shop's storage slots are on, booking a bike in SHALL offer "Where the bike is kept" with the shop's slots; choosing one SHALL be optional. While the bike is in the shop its slot SHALL be changeable; collecting it SHALL clear the slot. A job not yet booked in SHALL have no slot.

#### Scenario: Booked in on Hook 3
- **WHEN** staff book Maya Patel's bike in and choose Hook 3
- **THEN** the job page reads "Kept on Hook 3"

#### Scenario: Collected
- **WHEN** the bike on Hook 3 is collected
- **THEN** the job has no slot

#### Scenario: Not in the shop
- **WHEN** staff try to put a bike that isn't in the shop on a slot
- **THEN** it is refused

### Requirement: The workshop shows where each bike is kept
The job page SHALL show "Kept on [slot]" for a bike in the shop with a slot, the Overview's Custody column SHALL read "Kept on [slot]" for one, and a diary block SHALL show the slot where there's room. With slots off, none of these SHALL show.

#### Scenario: The Overview
- **WHEN** a bike is in the shop on Hook 3
- **THEN** its Custody reads "Kept on Hook 3"

### Requirement: Staff say which part a quoted labour line goes with
On the job page, a draft quote's labour line SHALL offer "Goes with" (Nothing, or one of the quote's parts), and a Needed line SHALL take "What happens without it" in the mechanic's words (Jack, 1 Oct, decision 7). Once sent, the line SHALL read "Goes with [part]". Recording an answer by phone or in the shop SHALL tick a pair together.

#### Scenario: Pairing fitting with pads
- **WHEN** staff choose Goes with Shimano brake pads on Fit and adjust brakes and send the quote
- **THEN** the job page shows "Goes with Shimano brake pads" on that line, and the customer's card ticks them together

### Requirement: Staff add a photo to a quote line
On the job page, a draft quote's line SHALL offer "Add photo for [line]"; with a photo it SHALL read "1 photo — view or add for [line]" and open the photo larger, with Replace photo and Remove from line (Jack, 1 Oct). The photo SHALL be a JPEG, PNG or WebP picture and SHALL also be one of the job's files.

#### Scenario: Adding the pads photo
- **WHEN** staff choose Add photo for Shimano brake pads and pick a picture
- **THEN** the line reads "1 photo — view or add for Shimano brake pads", and the picture is among the job's files

### Requirement: Staff can quote again after the customer says no to everything
After a customer declines every line of a quote, staff SHALL be able to add to the quote again, which starts a new quote with only the new lines and supersedes the declined one (Jack, 22 Oct).

#### Scenario: Quoting again
- **WHEN** Maya's quote was declined and staff use Add to quote for Shimano brake pads
- **THEN** a new quote with just the pads is made, and the declined one is superseded

### Requirement: The job page shows the customer's spending limit
The job page SHALL show the customer's choice as a tag: "Customer OK up to £[amount]" when they set a limit, or "Ask before any extra work" (Workshop day 42).

#### Scenario: A limit of £200
- **WHEN** staff open Maya's job, booked with a £200 limit
- **THEN** the job's details show "Customer OK up to £200"

### Requirement: Work within the customer's spending limit is agreed without a quote
When the customer set a spending limit and the whole bill with the extra work stays within it, staff SHALL be able to agree the work without sending a quote; it SHALL join the job and the customer SHALL be told (Workshop day 41–43). Over the limit, or with no limit, a quote SHALL be needed.

#### Scenario: Within £200
- **WHEN** Maya set £200, her service is £65 and staff add pads and fitting for £46
- **THEN** the work is agreed, joins the job, and Maya is sent "Work added within your limit"

#### Scenario: Over the limit
- **WHEN** Maya set £100 and the same work takes the whole bill to £111
- **THEN** it is refused with "That takes the whole bill to £111.00, over the £100 limit. Send a quote instead.", and nothing changes
