# workshop-diary Specification

## Purpose
The workshop diary is where staff see who is doing what and when, answer
what customers are waiting on, and book work in. Behind it sit the shop's
capacity rules (opening hours, lunch, leave and closures, each mechanic's
free time, minimum notice and the shop's own "today") and the workshop
settings that feed them. This spec says what the app does today. What a job
is and how it moves is in `workshop-jobs`.

## Requirements

### Requirement: The diary shows a week, Monday to Sunday
The staff diary SHALL open on the week holding today, as seven day columns from Monday to Sunday under an hour scale, with the week's dates named in the toolbar. Previous and Next SHALL move a week, and Today SHALL return to the current week. Each job SHALL sit in its own day at its own time, showing the bike and then the job's title. The diary SHALL keep its place in the page address, so a reload opens the same week and view.

#### Scenario: A job in its day
- **WHEN** staff open the diary on the week of 5 October 2026 and Maya Patel's Trek Domane AL 3 (WH-1042) is booked for "Standard service" on Tuesday 6 October, 10:00 to 11:00
- **THEN** the toolbar reads "5–11 October 2026" and the block sits in Tuesday 6 October's column showing "Trek Domane AL 3" and "Standard service"

#### Scenario: What a screen reader hears
- **WHEN** a screen reader reaches that block
- **THEN** it hears "Trek Domane AL 3, Standard service, Maya Patel, WH-1042, Expected, 10:00–11:00"

#### Scenario: Next week
- **WHEN** staff press Next week
- **THEN** the diary shows "12–18 October 2026" with that week's jobs

### Requirement: The Day view shows one column per mechanic
On a computer or tablet, staff SHALL be able to switch between Week and Day. The Day view SHALL show one day with a column for each active mechanic, and SHALL write the status word on each block. When a timed job on that day has no mechanic and no single mechanic is chosen, the Day view SHALL add a "Not assigned yet" column.

#### Scenario: Switching to Day
- **WHEN** staff choose Day on Tuesday 6 October
- **THEN** the toolbar reads "Tuesday 6 October", Alex Morgan and Jo Taylor each have a column, and Alex Morgan's column shows "Trek Domane AL 3" with "Standard service · Expected"

### Requirement: Staff can show one mechanic's jobs
The diary SHALL offer people chips: Everyone, then each active mechanic. Choosing a mechanic SHALL show only that mechanic's jobs; a booking request with no mechanic yet SHALL show only under Everyone.

#### Scenario: Choosing Alex Morgan
- **WHEN** staff choose the Alex Morgan chip
- **THEN** Alex Morgan's Trek Domane AL 3 still shows, while Jo Taylor's Brompton C Line and the unassigned request for the Specialized Sirrus do not

### Requirement: Each job is drawn in its status colour, with a legend
Each block SHALL be drawn in the colour of one status word: Pending for a booking request, Change requested for a booking with a customer's change request waiting, Waiting for parts, Finished for finished work, Quoting when the job's quote is waiting for the customer, and Expected for anything else, including work started or on hold. A legend under the grid SHALL name every colour.

#### Scenario: Started work
- **WHEN** a job's work has started, or is on hold
- **THEN** its block reads Expected, in the Expected colour

#### Scenario: A quote waiting for the customer
- **WHEN** a job's latest quote has been sent and not yet answered
- **THEN** its block reads Quoting, in its own teal

#### Scenario: The legend
- **WHEN** staff look under the grid
- **THEN** the legend reads "Expected, booked in or in the workshop", "Pending", "Quoting", "Change requested", "Waiting for parts", "Finished" and "Cancelled"

### Requirement: Ended bookings leave the diary, except a customer's cancellation until it is seen
The diary SHALL NOT draw declined bookings, expired bookings, or bookings the shop cancelled. A booking the customer cancelled SHALL stay on the diary, struck through and reading Cancelled, until someone marks it seen; then it SHALL go.

#### Scenario: A declined booking
- **WHEN** Jamie Brooks's Giant Escape 2 booking has been declined
- **THEN** it is not drawn

#### Scenario: A customer's cancellation
- **WHEN** Aisha Khan cancelled her Cannondale Quick booking and nobody has marked it seen
- **THEN** it shows struck through, reading "Cancelled"

### Requirement: Jobs with no time sit in the No time row
A job with no start time SHALL NOT be drawn on the time grid. In the Week view on a computer or tablet it SHALL appear as a chip showing only the bike, in one "No time" row above the grid for the whole week; a click, a tap or Enter on the chip SHALL open the job's page, as a block does, and the chip SHALL NOT be moved. The Day view SHALL have the same row above its grid, with that day's untimed jobs only (Jack, 15 Oct). On a phone the row SHALL show the day's untimed jobs only when one column shows, and read "None" when there are none; its chips open the job in the same way.

#### Scenario: An untimed job
- **WHEN** [customer name]'s [bike] is booked for a Standard service on Tuesday with no time
- **THEN** "[bike]" sits in the Week view's No time row

#### Scenario: An untimed job in the Day view
- **WHEN** staff open the Day view for Tuesday
- **THEN** "[bike]" sits in its No time row, and a Wednesday job with no time does not

#### Scenario: Opening an untimed job
- **WHEN** staff click, or press Enter on, the No time chip for [bike]
- **THEN** that job's page opens

### Requirement: The grid covers the shop's opening hours
The time grid SHALL run from the shop's earliest opening to its latest closing across the week, in 30-minute rows, or 09:00 to 18:00 when no hours are set. A job outside those hours SHALL stretch the grid, on the hour, so it still shows.

#### Scenario: A short Saturday that opens early
- **WHEN** the shop opens Monday 09:00–17:00 and Saturday 08:00–13:00
- **THEN** the grid runs from 08:00 to 17:00

#### Scenario: A job after closing
- **WHEN** the shop closes at 17:00 on Monday and a job runs from 17:30 to 19:00
- **THEN** the grid runs from 09:00 to 19:00

### Requirement: Overlapping jobs share the column
Jobs in one column that overlap but start at different times SHALL sit side by side, each at its true start and end; a job with the column to itself SHALL keep all of it.

#### Scenario: Jobs that only partly overlap
- **WHEN** two jobs overlap but start at different times
- **THEN** they sit side by side, not stacked

### Requirement: Jobs that start together become one stack
Jobs in one column that start at the same time SHALL become one stack, showing the front job and a count. Clicking or tapping a stack SHALL open a chooser with a tile for each job that opens it. Resting the mouse on a stack for 0.3 seconds, or a press and hold on a touch screen, SHALL fan its jobs out as diary blocks that open, move and summarise like any job.

#### Scenario: Two jobs at 09:00
- **WHEN** Jamie Brooks's Giant Escape 2 Safety check (WH-1038) and Aisha Khan's Cannondale Quick Gear service (WH-1040) both start at 09:00 on Tuesday 6 October
- **THEN** they show as one stack, and choosing it opens "2 jobs at 09:00" with "Tuesday 6 October · choose one to open" and a tile for each

### Requirement: A job over several days has a block on each day
A job worked over more than one day SHALL have a block on each of its days, at that day's time and mechanic, each saying "Day [n] of [total]".

#### Scenario: A two-day job
- **WHEN** [customer name]'s [bike], "[job title]" ([job number]), is booked 10:00 to 12:00 on Monday 5 and Tuesday 6 October
- **THEN** Monday shows it as "day 1 of 2" and Tuesday shows "Day 2 of 2 · [job title]"

### Requirement: A customer's change request shows where the customer wants to go
A booking with a customer's change request waiting SHALL show amber at its current time, and a dashed outline reading "Requested [time]" at the time the customer asked for, when that time falls in a day and column on screen, also in a week where the booking itself is not (Jack, 15 Oct). A screen reader SHALL hear "[bike] asks to move here: [time]", or "[customer] asks to move here: [time]" in a week without the booking. The outline of a request chosen from "Waiting for you" SHALL take the strong mark a chosen block has; when it is on screen, the booking's own block SHALL take only a light grey ring (the drawing's change-selected).

#### Scenario: Oliver Chen asks to move
- **WHEN** Oliver Chen's Brompton C Line is booked at 10:00 on Monday 5 October and he asks for 14:00 the same day
- **THEN** the block reads Change requested and Monday shows "Brompton C Line asks to move here: 14:00–15:00"

#### Scenario: Oliver Chen asks for another week
- **WHEN** Oliver Chen's Brompton C Line is booked at 10:00 on Monday 5 October, he asks for 14:00 on Wednesday 14 October with Alex Morgan, and staff choose his card
- **THEN** the diary shows "12–18 October 2026" and Wednesday shows "Requested 14:00" and "Oliver Chen asks to move here: 14:00–15:00, chosen from Waiting for you"

### Requirement: On a phone the diary is one day at a time
Below tablet width the diary SHALL show one day, chosen from a strip of the week's seven days in place of the Week and Day switch, with arrows that move a week and keep the weekday. One people chip SHALL choose Everyone (one column), By mechanic (a column each) or one person. "Waiting" with its count SHALL sit in the top bar and open the list as a sheet; choosing a card SHALL go to its day, or for a change request into another week to the day asked for (Jack, 15 Oct).

#### Scenario: A phone opens on Tuesday
- **WHEN** staff open the diary on a phone on Tuesday 6 October
- **THEN** seven day tabs show with Tuesday chosen, Tuesday's jobs show, Monday's do not, and there is no Week tab

#### Scenario: The week arrows
- **WHEN** staff press Next week on Tuesday 6 October
- **THEN** the label reads "12–18 Oct" and Tuesday 13 October is chosen

#### Scenario: By mechanic
- **WHEN** staff open the people chip and choose By mechanic
- **THEN** Alex Morgan and Jo Taylor each get a column

#### Scenario: A waiting card on a phone
- **WHEN** staff open Waiting and choose the card for a booking request on Thursday 8 October
- **THEN** the diary goes to Thursday 8 October with a bar at the bottom showing the customer and Open, and Open shows the request

#### Scenario: A change request into another week on a phone
- **WHEN** Oliver Chen's Brompton C Line is booked on Tuesday 6 October, he asks for 14:00 on Tuesday 13 October, and staff choose his card
- **THEN** Tuesday 13 October is chosen and shows "Requested 14:00"

### Requirement: Staff can move a job by dragging it or from the keyboard
Staff SHALL be able to drag a timed job to another time or day, or, in the Day view, to another mechanic, snapped to 15 minutes and kept inside the grid's hours. From the keyboard, M SHALL pick a job up, the arrows move it 15 minutes or a column, Enter or Space save it and Escape put it back, each step read out. Saving SHALL send the version the diary saw, and the mechanic only when it changed. A later day of a job SHALL move on its own. A click or Enter that is not a move SHALL open the job.

#### Scenario: Moving from the keyboard
- **WHEN** staff press M on the Trek Domane AL 3 block (Tuesday 6 October, 10:00–11:00), press the down arrow twice and the right arrow once
- **THEN** it reads "Moving Trek Domane AL 3. Wed 7 Oct, 10:30–11:30.", and Enter saves that day and time with the version the diary saw

#### Scenario: Escape
- **WHEN** staff pick the job up, move it and press Escape
- **THEN** it reads "Move cancelled. Trek Domane AL 3 stays at Tue 6 Oct, 10:00–11:00." and nothing is saved

#### Scenario: Another mechanic in the Day view
- **WHEN** staff pick the job up in the Day view and press the right arrow
- **THEN** it reads "Moving Trek Domane AL 3. Tue 6 Oct, 10:00–11:00, Jo Taylor." and Enter saves it to Jo Taylor

#### Scenario: Moving a second day
- **WHEN** staff move day 2 of that job to Wednesday 7 October
- **THEN** only day 2 moves

### Requirement: A move the shop's rules refuse is put back, and says why
A move SHALL be checked against the shop's rules for a job's day and time (see `workshop-jobs`). When it is refused, the job SHALL stay where it was and the diary SHALL show "Couldn't move [bike]: " and why: the server's reason when it is already plain English, "The work is already finished. Reopen the job to change it." for finished work, "This job no longer exists." for a deleted job, "That mechanic is no longer working here. Choose another." for a mechanic who has left (Jack, 15 Oct), or "This job changed while you were looking at it." and reload when someone else changed the job first. A booking request, a customer's cancellation and a job with no time SHALL NOT be movable on the diary.

#### Scenario: A clash with another job
- **WHEN** staff drop a job over another of the same mechanic's jobs
- **THEN** the diary shows "Couldn't move Trek Domane AL 3: That mechanic is already booked over part of that window - please choose another time."

#### Scenario: Someone else got there first
- **WHEN** another member of staff changed the job after this diary loaded
- **THEN** the diary shows "Couldn't move Trek Domane AL 3: This job changed while you were looking at it."

#### Scenario: A booking request
- **WHEN** the Specialized Sirrus booking is still a request
- **THEN** it cannot be picked up or dragged

#### Scenario: Finished work
- **WHEN** staff drop a job whose work is finished
- **THEN** the diary shows "Couldn't move Trek Domane AL 3: The work is already finished. Reopen the job to change it."

### Requirement: Dropping a job on the customer's requested time accepts the change
When a job with a customer's change request waiting is saved onto exactly the requested day, start time and mechanic, the change SHALL be accepted, whatever the job's length. In the Week view, or a column for everyone, a drop of the job's first day on exactly the requested day and start time SHALL send the mechanic the customer asked for. Saved anywhere else, the request SHALL stand, with both the job's own time and the requested time held.

#### Scenario: Dropped on the requested start
- **WHEN** a booking at 10:00 whose customer asked for 14:00 on another day is saved to that day at 14:00 to 15:30
- **THEN** it is confirmed at 14:00 to 15:30, no request remains, and one hold is kept, at the new time

#### Scenario: Dropped elsewhere
- **WHEN** the same booking is moved to 12:00 on its own day
- **THEN** it still reads Change requested, held at 12:00 and at the requested 14:00

#### Scenario: Dropped on the outline in the Week view, for another mechanic
- **WHEN** the customer asked to move from Alex Morgan to Jo Taylor and staff drop the job on the dashed outline in the Week view
- **THEN** the move is sent with Jo Taylor as the mechanic, so the change is accepted

#### Scenario: A later day dropped on the requested time
- **WHEN** a two-day job's customer asked to move it, and staff drop day 2 on the requested day and time in the Week view
- **THEN** day 2 moves with its own mechanic and the request stays

### Requirement: New job starts by choosing a time on the diary
New job SHALL turn the diary to "Choose a time for the new job.", with "Enter a time instead" and Cancel. A click on the grid SHALL open the New job form at that time, snapped to 15 minutes, with no date or time box; Cancel SHALL leave the diary as it was. "Enter a time instead" SHALL open the form with a Date box and a Start time box in place of the time, filled with the diary's date and the grid's first hour, and the job SHALL be saved at what they hold; with either box empty, Save job SHALL say "Choose a date and a start time.", and with a start time off the quarter hour "Choose a start time on the quarter hour, like 14:30 or 14:45.", and keep the form open (Jack, 15 Oct). Opened this way, the Date box SHALL have the focus. A job that would run past midnight SHALL be refused with "The job would run past midnight. Choose an earlier start time." In the Day view the clicked column's mechanic SHALL be chosen, or Shared queue in the "Not assigned yet" column. Otherwise the form SHALL choose a mechanic as the next requirement says.

#### Scenario: Clicking Tuesday at 10:00
- **WHEN** staff press New job and click Tuesday 6 October at 10:00, where Alex Morgan already has a job and Jo Taylor has none
- **THEN** the form opens reading "Tue 6 Oct · 10:00 · Jo Taylor" with Jo Taylor chosen, and no date or time box

#### Scenario: Cancel
- **WHEN** staff press New job and then Cancel
- **THEN** the New job button returns and no form opens

#### Scenario: Enter a time instead
- **WHEN** staff press "Enter a time instead" in the Week view
- **THEN** the form opens with Date and Start time boxes holding the date in the page address and the grid's first hour

#### Scenario: Changing the time entered
- **WHEN** staff open the form by "Enter a time instead", change Start time to 14:30 and the date to Thursday, and save
- **THEN** the job is created on that Thursday from 14:30

### Requirement: New job chooses the mechanic with the fewest timed minutes
Outside a mechanic's own column, New job SHALL choose, among the mechanics whose working days include that weekday, the one with the fewest minutes of timed jobs on that day in the diary, counting cancelled, declined and expired bookings too; on a tie, the first in the list. If nobody works that weekday, it SHALL choose from everyone. The form SHALL say "Mechanic chosen automatically: most free time on [weekday]." until staff pick a mechanic themselves. When the Date box changes, the form SHALL choose again for the new day, unless staff have picked one; it counts only the jobs the diary has loaded, so for a day outside the week shown it chooses the first mechanic working that weekday.

#### Scenario: Jo Taylor has nothing booked
- **WHEN** both mechanics work Tuesdays and only Alex Morgan has a timed job on Tuesday 6 October
- **THEN** Jo Taylor is chosen

#### Scenario: A new date entered
- **WHEN** the form opened by "Enter a time instead" on Monday 5 October has Alex Morgan chosen, and staff change the date to Tuesday 6 October
- **THEN** Jo Taylor is chosen, and the form says "Mechanic chosen automatically: most free time on Tuesday."

### Requirement: The New job form finds the customer and fills in the work
The New job form SHALL find a customer by name, phone or email and offer their bikes, choosing an only bike for them. The work SHALL be chosen as Full service or Individual service pills listing only the shop's active services; choosing one SHALL fill the job title and the job's length. New bike build or pre-delivery check SHALL make the customer optional. The mechanic SHALL be chosen from pills that include Shared queue, and the starting status SHALL be Booked or Waiting for parts.

#### Scenario: A Brake service
- **WHEN** staff choose Individual service and then "Brake service · 45 min"
- **THEN** the title becomes "Brake service" and the form reads "Tue 6 Oct · 10:00–10:45 · Jo Taylor"

#### Scenario: A retired service
- **WHEN** a service is no longer active
- **THEN** it is not offered

### Requirement: Saving a new job
Save job SHALL create the job with what the form holds and, when work was chosen, its planned length; with no work chosen the job SHALL be an hour long. A title SHALL be needed, and a customer unless it is a new bike build. If the server refuses, the form SHALL show its words and stay open. "The bike is here now" SHALL book the bike in straight after saving, unless the job was created with the bike already in the shop.

#### Scenario: Maya Patel's Brake service
- **WHEN** staff find "Maya", choose Maya Patel, choose "Brake service · 45 min" and save
- **THEN** a job is created for Maya Patel's Trek Domane AL 3 on Tuesday 6 October from 10:00 to 10:45 with Jo Taylor, booked, with a planned length of 45 minutes

#### Scenario: The bike is here now
- **WHEN** staff turn on "The bike is here now" and save with the starting status Booked
- **THEN** the job is created and then booked in

#### Scenario: The bike is here now, waiting for parts
- **WHEN** staff turn on "The bike is here now" and save with the starting status Waiting for parts
- **THEN** the job is created with the bike already in the shop, no book-in is sent, and the form closes

#### Scenario: No customer
- **WHEN** staff save a job titled "Safety check" with no customer and New bike build off
- **THEN** the form says "Give the job a title, and choose a customer or turn on New bike build."

### Requirement: Staff can open a job's menu, summary and overview from the diary
Right-clicking a job, a press and hold on a touch screen, or the Menu key or Shift+F10, SHALL open "Job actions" with Open job and View overview, or on a booking request "Accept or decline" (opening its request pop-up, Jack, 18 Oct) and View overview; holding the right mouse button SHALL open the overview straight away. Resting the mouse on a job for about 0.6 seconds (at once when motion is reduced) SHALL show its summary. The summary and View overview SHALL show the job, customer and bike, the notes, the work and parts, and the cost.

#### Scenario: View overview
- **WHEN** staff right-click Maya Patel's Trek Domane AL 3 (WH-1042, Standard service) and choose View overview
- **THEN** it shows "Maya Patel · Trek Domane AL 3", her note "My rear brake squeals and feels weak. The gears could use a tune-up too.", the work and parts on the order (Standard service, Shimano brake pads, Fit & adjust brakes) and their cost, £111.00, with the quote line she declined, Replace gear cable, struck through

#### Scenario: Nothing on the order yet
- **WHEN** staff view the overview of a job with nothing on its order
- **THEN** it says "No work or parts yet." and £0.00

#### Scenario: From the keyboard
- **WHEN** staff press Shift+F10 on a job, move with the arrow keys and press Escape
- **THEN** the menu opens on Open job, moves to View overview, closes, and focus returns to the job

#### Scenario: A booking request
- **WHEN** staff right-click Sam Reed's booking request and choose "Accept or decline"
- **THEN** its request pop-up opens, with Accept

### Requirement: "Waiting for you" lists what customers are waiting on staff for
"Waiting for you" SHALL list, for the signed-in shop only: new online booking requests (not requests staff made themselves); customers' change requests; and bookings the customer cancelled, until someone marks them seen (never the shop's own cancellations). Items SHALL come oldest first by when each arrived. Each SHALL carry the job number, day, time and mechanic, the customer and the services in order; a change request SHALL also carry where the customer wants it.

#### Scenario: A new online booking
- **WHEN** Sam Reed books a Brake service online with [mechanic] at 10:00
- **THEN** it is listed as a new booking from 10:00 to 10:45 with [mechanic], for Sam Reed, with that service, arriving when the booking was made

#### Scenario: A change request
- **WHEN** a confirmed booking with Jo at 10:00 asks to move to 14:00 with Alex on another day
- **THEN** it is listed as a change request from 10:00–11:00 with Jo to 14:00–15:00 with Alex

#### Scenario: Oldest first
- **WHEN** a cancellation arrived on 8 September, a change request on 9 September and a new booking on 10 September
- **THEN** they are listed in that order

#### Scenario: Another shop
- **WHEN** another shop receives an online booking
- **THEN** it never appears in this shop's list

### Requirement: The diary's Waiting column chooses and opens what is waiting
On a computer or tablet the diary SHALL show "Waiting for you ([n])" beside the grid, refreshed every minute, one card per item with its kind, the customer, and the services and time or the move; with nothing waiting it SHALL say "Nothing waiting." One click on a card SHALL choose it: the diary moves to that job's week, or for a change request into another week to the week the customer asked for (Jack, 15 Oct), shows Everyone, marks its block, and the card shows Open. Open, or a double-click, SHALL open the request. On a touch screen a second tap on the chosen card SHALL open it too (Workshop day decision 14); a second click with a mouse SHALL NOT.

#### Scenario: Choosing Sam Reed's request
- **WHEN** staff click Sam Reed's card, booked for 14 October
- **THEN** the diary shows "12–18 October 2026" and the Specialized Sirrus block is marked "chosen from Waiting for you"

#### Scenario: A card's words
- **WHEN** Sam Reed has asked for a Brake service on Friday 9 October, 10:00–10:45 (the Week view's example)
- **THEN** his card reads "New booking request", "Sam Reed" and "Brake service · Fri 9 Oct, 10:00–10:45"

#### Scenario: Double-click
- **WHEN** staff double-click Aisha Khan's cancellation card
- **THEN** its pop-up opens straight away

#### Scenario: A second tap on a tablet
- **WHEN** staff tap Aisha Khan's cancellation card on a tablet, then tap it again
- **THEN** the first tap chooses it and the second opens its pop-up

#### Scenario: A second click with a mouse
- **WHEN** staff click Aisha Khan's cancellation card with a mouse, then click it again
- **THEN** it stays chosen and its pop-up does not open

### Requirement: Staff answer a new booking request in a pop-up
A new booking request SHALL open in a pop-up headed "[customer] · [bike]" with "Pending request", what the customer told us (or "No message from the customer."), the service and the time asked for. Accept SHALL accept the booking with the version the pop-up saw, close the pop-up and refresh the diary. Decline SHALL ask first, with Decline booking to confirm and Keep booking to back out. Accepting and declining follow `workshop-jobs`.

#### Scenario: Sam Reed's request
- **WHEN** staff open Sam Reed's request for a Brake service on Friday 9 October, 10:00–10:45
- **THEN** the pop-up is headed "Sam Reed · Specialized Sirrus" and reads "Requested Fri 9 Oct, 10:00–10:45"

#### Scenario: Decline asks first
- **WHEN** staff press Decline
- **THEN** the pop-up asks "Decline Sam Reed's booking for Fri 9 Oct? This can't be undone."

#### Scenario: Keep booking
- **WHEN** staff press Decline and then Keep booking
- **THEN** nothing is sent and Accept shows again

### Requirement: Staff accept a customer's change request
Accepting a change request SHALL need the version staff last read, and SHALL move the booking to the requested day, time and mechanic, confirm it, clear the request and turn the requested time's hold into the booking's own, so the job keeps one hold. It SHALL be checked against the shop's rules for that time, never against capacity, and SHALL wait while another booking is being written for that day.

#### Scenario: Accepting
- **WHEN** staff accept a request to move a 10:00 booking with Jo to 14:00 on another day
- **THEN** the booking is confirmed at 14:00–15:00 on that day with no request left, and it holds only that time

#### Scenario: The time has gone
- **WHEN** another job now covers 14:30 to 15:30 with Jo on the requested day
- **THEN** accepting is refused with "The requested time is no longer free" and the request still stands

#### Scenario: No version, or an old one
- **WHEN** staff send no version, or the version from before the customer asked
- **THEN** it is refused with "version is required - send the version you last read" or "This job changed while you were looking at it. Reload and try again."

#### Scenario: Nothing to accept
- **WHEN** staff accept a change on a booking with no request
- **THEN** it is refused with "There's no change request to accept"

### Requirement: Staff decline a customer's change request
Declining a change request SHALL need the version staff last read, and SHALL keep the booking where it was, confirmed, clear the request, let the requested time go and record that the change was declined, so the customer's link says so.

#### Scenario: Declining
- **WHEN** staff decline a request to move to 14:00 on another day
- **THEN** the booking stays at its original time, confirmed, and another customer can now book 14:00 on that day

#### Scenario: Nothing to decline
- **WHEN** staff decline a change on a booking with no request
- **THEN** it is refused with "There's no change request to decline"

### Requirement: The change request pop-up shows from and to
A change request SHALL open in a pop-up headed "Change request", with the customer and bike, From and To as day, time and mechanic ("Shared queue" when there is none), and the sentence "The customer asked to move this booking. Accepting keeps the same work.", with Accept and Decline, each sent with the version the pop-up saw. Accepting SHALL move the booking to the To side's day, time and mechanic.

#### Scenario: Oliver Chen's change
- **WHEN** staff open Oliver Chen's request to move from Monday 5 October at 10:00 with Sam to 14:00 with Alex Morgan
- **THEN** the pop-up shows "Mon 5 Oct · 10:00 · Sam" and "Mon 5 Oct · 14:00 · Alex Morgan", and Accept accepts the change

#### Scenario: A request for another mechanic
- **WHEN** a booking with Sam asks to move to Alex and staff accept it from the pop-up
- **THEN** the booking moves to Alex, as the pop-up's To side said

### Requirement: Staff mark a customer's cancellation as seen
A customer's cancellation SHALL open in a pop-up headed "Cancelled booking", saying when the customer cancelled and "No further action is needed.", with one answer, Seen. Seen SHALL need the version staff last read, keep the first time it was seen, and take the cancellation off "Waiting for you" and off the diary. Seen on anything else SHALL be refused with "Only a customer's cancellation can be marked as seen".

#### Scenario: Aisha Khan's cancellation
- **WHEN** staff open Aisha Khan's cancellation, made on Saturday 3 October, and press Seen
- **THEN** the pop-up read "Cancelled by the customer on Sat 3 Oct." and the cancellation leaves the list

#### Scenario: Seen on a live booking
- **WHEN** staff send Seen for a booking nobody cancelled
- **THEN** it is refused with "Only a customer's cancellation can be marked as seen"

#### Scenario: An old version
- **WHEN** staff send Seen with the version from before the customer cancelled
- **THEN** it is refused with "This job changed while you were looking at it. Reload and try again."

### Requirement: An answer someone else got to first says so plainly
When an answer from a request pop-up is refused, the pop-up SHALL stay open, say why in plain words and show the job afresh. Someone else changing the job first SHALL read "This job changed while you were looking at it.", also when the answer is no longer allowed because the job has moved on. A time that has gone SHALL read "The requested time is no longer free.", a deleted job "This job no longer exists.", and no connection "Couldn't reach the server — try again."

#### Scenario: Someone else accepted first
- **WHEN** staff press Accept on a job another member of staff has just changed
- **THEN** the pop-up says "This job changed while you were looking at it." and reads the job again

#### Scenario: The requested time has gone
- **WHEN** staff accept a change whose time has been taken
- **THEN** the pop-up says "The requested time is no longer free."

### Requirement: Other ways a booking changes keep or end a customer's request
A save from the old app's job form SHALL keep a customer's change request and its hold, and keep it in "Waiting for you", whether it resends the confirmed status or sets Waiting for parts, On hold or Complete (the booking stays confirmed). Only saving the old "pending" status SHALL end the request and let its time go. A cancellation by the shop SHALL clear the request and release every hold; a staff reschedule request SHALL never hold a time.

#### Scenario: An ordinary old-app save
- **WHEN** staff add a note ([note]) from the old form while a change request waits
- **THEN** the booking still reads Change requested and is still listed in "Waiting for you"

#### Scenario: Saving the old pending status
- **WHEN** staff save the status "pending" from the old form while a change request waits
- **THEN** the request ends and only the booking's own time stays held

#### Scenario: The shop cancels a requested booking
- **WHEN** staff cancel a booking whose customer asked to move it
- **THEN** no request and no held time remain

### Requirement: Each weekday can have its own opening hours
The server SHALL accept which weekdays are open and each open day's hours, on the hour (no screen sets a day's own hours yet); a day without its own hours SHALL use the usual hours. A new shop SHALL be open every day, 09:00 to 18:00. Changing only the usual hours SHALL keep a day's own hours. Hours that close before they open SHALL be refused with "Closing time must be after opening time". A staff job outside a day's own hours SHALL be refused naming that day's hours.

#### Scenario: A shorter Saturday and a closed Sunday
- **WHEN** the shop opens Monday to Friday 09:00–18:00 and Saturday 09:00–17:00, closed Sunday
- **THEN** Saturday reports 09:00–17:00, Monday 09:00–18:00, and Sunday is not open

#### Scenario: Re-opening a day
- **WHEN** Saturday is closed and then opened again
- **THEN** it opens at the usual 09:00–18:00, not its old shorter hours

#### Scenario: A job after Saturday's close
- **WHEN** staff book a job on that Saturday from 16:30 to 17:30
- **THEN** it is refused with "That job doesn't fit in the shop's opening hours (09:00–17:00) - please choose an earlier time or a shorter job type."

#### Scenario: Both lists at once
- **WHEN** a save sends the day-by-day hours and the list of open days together
- **THEN** it is refused with "Send openingHours or openingDays, not both"

### Requirement: Lunch, leave and closures are blocks of unavailable time
The server SHALL accept, change, list and remove blocks of three kinds (no screen does this yet): weekly for one mechanic between two times (lunch); one mechanic over a date range, all day or between two times (leave); and a shop closure over a date range, always whole days. Each MAY carry a reason of up to 200 characters. A change SHALL keep fields it leaves out. Another shop's mechanic or block SHALL not be found.

#### Scenario: Lunch
- **WHEN** staff add Jo's lunch, Monday to Friday 13:00–13:30, with the reason [reason]
- **THEN** it is saved and listed

#### Scenario: A closure with times
- **WHEN** staff add a shop closure from 09:00 to 12:00
- **THEN** it is refused with "A shop closure covers whole days - leave the times out"

#### Scenario: A weekly block with no mechanic
- **WHEN** staff add a weekly block with no mechanic
- **THEN** it is refused with "A weekly block needs a mechanic"

#### Scenario: Changing the end time
- **WHEN** staff change only the lunch's end time to 14:00
- **THEN** the reason is kept

#### Scenario: Listing a date range
- **WHEN** staff list blocks from 2 to 31 January 2030
- **THEN** every weekly block and the date blocks overlapping that range are listed, and a block in March is not

### Requirement: A new block reports the bookings it clashes with and moves none
Adding or changing a block SHALL report the live bookings it overlaps, from the later of the block's first day and the shop's today, and SHALL NOT move or cancel them. A shop closure SHALL clash with every job on its days; a mechanic's whole-day block only with that mechanic's jobs; a timed block only with that mechanic's timed jobs it overlaps. Cancelled bookings SHALL NOT clash.

#### Scenario: Lunch over a job
- **WHEN** staff add a Monday lunch 13:00–13:30 for Jo, who has a job 12:45–13:45 and another 15:00–16:00
- **THEN** the first job is reported as a clash and stays at 12:45, and the second is not reported

#### Scenario: A closure over a walk-in
- **WHEN** staff close the shop on a day with an unassigned 60-minute job
- **THEN** that job is reported as a clash

### Requirement: Staff are held to the shop's rules but never to capacity
A job staff create, edit, move or accept SHALL be checked against the shop's open days, the day's hours, the mechanic's working days, the mechanic's other jobs (see `workshop-jobs`) and another customer's waiting requested time, but SHALL NOT be refused because of a block, the reserve or the mechanic's free minutes. The only capacity refusal staff can meet SHALL be a time held by a leftover hold with no job behind it, refused with "That time is no longer available - please choose another.".

#### Scenario: Booking into lunch
- **WHEN** staff book Jo from 13:00 to 13:30 on a Tuesday when Jo has lunch then
- **THEN** the job is created

#### Scenario: Over another customer's requested time
- **WHEN** staff book Jo from 14:30 to 15:30 on a day another customer has asked to move to 14:00–15:00 with Jo
- **THEN** it is refused with "That mechanic is already booked over part of that window - please choose another time."

#### Scenario: Past a full day
- **WHEN** Alex is booked 09:00 to 18:00 and staff add a 240-minute job for Alex that day with no time
- **THEN** the job is created

### Requirement: Each mechanic's free time is worked out one way for everyone
A mechanic SHALL have time only on a weekday the shop opens and they work, with no shop closure. From the day's hours SHALL come off: their blocks; their timed jobs, overlaps counted once; their untimed jobs' minutes; an equal share of the shared queue (jobs with no mechanic) among the mechanics with any time that day; and the reserve. Ended bookings SHALL take no time; a customer's requested time SHALL take time until answered.

#### Scenario: Lunch and a job
- **WHEN** Jo works 09:00–18:00 on a Monday with lunch 13:00–13:30 and a job 12:45–13:15
- **THEN** Jo's first free window is 09:00–12:45 and Jo has 495 free minutes

#### Scenario: The shared queue
- **WHEN** two mechanics each have a 540-minute drop-off day and 1000 minutes of unassigned work are queued
- **THEN** each carries 500 of them

#### Scenario: Assigning a queued walk-in
- **WHEN** a 120-minute walk-in in the shared queue is given to Jo
- **THEN** the queue drops to 0 and Jo's free minutes drop by the 60 the other mechanic had been carrying

#### Scenario: Leave
- **WHEN** one mechanic is on leave for the day
- **THEN** that mechanic takes no share of the shared queue

### Requirement: Staff can see the capacity of a range of days
The server SHALL give signed-in staff, for up to 62 days (no screen shows it yet), each day's booking mode, whether the shop is closed and why, the shared queue's minutes, the clashes between blocks and jobs (never a job's requested time), and for each mechanic whether they work, their free minutes, free windows and blocks with reasons. Without a sign-in it SHALL be refused, as SHALL bad dates, an end before the start, or more than 62 days ("Ask for at most 62 days at a time").

#### Scenario: A shop closure
- **WHEN** the shop is closed on 8 September 2026 for [reason]
- **THEN** that day reads closed, with that reason, and every mechanic has 0 free minutes

#### Scenario: Too long a range
- **WHEN** staff ask for 1 September to 2 November 2026
- **THEN** it is refused

### Requirement: Customers are offered only the time capacity allows
For the customer booking pages, a timed day SHALL offer each mechanic every start on the half hour where the whole job fits one free window and the day still has the minutes; a drop-off day SHALL say, per mechanic, whether the job's minutes still fit, with the drop-off window. Asking for one mechanic SHALL narrow the answer but not the shared queue's split. A cancelled booking's time SHALL be offered again.

#### Scenario: A shorter Saturday
- **WHEN** Saturday closes at 17:00 and a customer asks for a 60-minute job
- **THEN** the last start offered is 16:00

#### Scenario: Drop-off
- **WHEN** the shop is in drop-off mode and each mechanic has 40 minutes left
- **THEN** a 40-minute job is bookable with a 09:00–10:00 drop-off window, and a 41-minute job is not

#### Scenario: A cancelled booking
- **WHEN** Jo's 10:00 booking is cancelled
- **THEN** 10:00 is offered again

### Requirement: Customers are told nothing about why time is taken
What customers are offered SHALL NOT include a block's reason, other customers' jobs or minute totals. The older booking page SHALL see blocks, closures and shorter days only as busy time with a mechanic, a date and a window, and a mechanic-day with nothing left as full. More than 62 days, a job length outside 1 to 720 minutes, a date that does not exist, an end before the start, or a mechanic that is not a number SHALL be refused.

#### Scenario: A lunch block's reason
- **WHEN** Jo has lunch on Mondays 13:00–13:30, with the reason [reason], and a customer asks for a 60-minute job on a Monday
- **THEN** Jo is offered 12:00 but not 12:30 or 13:00, Alex is offered 13:00, 13:00–13:30 shows as busy, and the reason appears nowhere

#### Scenario: A closure
- **WHEN** the shop is closed for [reason]
- **THEN** no start is offered that day, every working mechanic's day is full, and the reason appears nowhere

### Requirement: Customers are held to capacity when they book or change
A customer's booking or change SHALL be refused when the time is in a block or outside the mechanic's time, when it would leave the mechanic's day short of the reserve, when it overlaps another booking or a customer's requested time, or when another booking already holds that start. In drop-off mode a chosen time SHALL be refused. A refused booking SHALL leave nothing behind.

#### Scenario: A block
- **WHEN** a customer asks to move to 14:00 with Jo, who has a block from 13:00 to 15:00
- **THEN** it is refused with "That mechanic is unavailable at that time - please choose another time or day."

#### Scenario: The reserve
- **WHEN** the mechanic has 180 minutes left in the day before the 120-minute reserve
- **THEN** a 30-minute job is accepted and a 120-minute service is refused with "That mechanic does not have enough free time that day - please choose another day, or a shorter job."

#### Scenario: A requested time
- **WHEN** a customer asks for 14:30 with Jo while another customer's request for 14:00–15:00 waits
- **THEN** it is refused with "That mechanic is already booked over part of that window - please choose another time."

#### Scenario: Four at once
- **WHEN** four overlapping bookings for the same mechanic arrive at the same moment
- **THEN** exactly one is made and the other three are refused as taken

#### Scenario: A time on a drop-off day
- **WHEN** a customer picks a time on a drop-off day
- **THEN** it is refused with "This shop takes drop-offs on that day - choose the day, not a time."

### Requirement: Every live job holds its time
Every booking that is a request, confirmed or awaiting a reschedule SHALL hold its time: with a mechanic, its start and length; with no mechanic, only its length, so unassigned jobs never collide, nor a mechanic's drop-off jobs on one day. Moving or resizing a job SHALL move its hold. Cancelling, declining or expiring SHALL release it at once; deleting a job SHALL remove it. Bookings for one shop and day SHALL be written one at a time.

#### Scenario: A walk-in
- **WHEN** staff add a 60-minute job with no mechanic and no time on a Monday
- **THEN** it holds 60 minutes on that Monday with no start, and the shared queue reads 60

#### Scenario: Cancelling
- **WHEN** a customer's booking is cancelled
- **THEN** its hold is released and the time can be booked again

#### Scenario: Two at the same start
- **WHEN** two timed holds for the same mechanic share a start
- **THEN** the second is refused

### Requirement: A customer's requested time is held until staff answer
A customer's requested time SHALL be held beside the job's own until staff answer, keeping other customers out of it and off the calendar, and refusing staff jobs over it too. A job's own request SHALL never block that job, and a job that stops being a request SHALL let its requested time go and keep its own.

#### Scenario: A requested time keeps others out
- **WHEN** a customer has asked to move to 14:00–15:00 with Jo
- **THEN** the calendar does not offer Jo 13:30, 14:00 or 14:30 for a 60-minute job

#### Scenario: The job's own request
- **WHEN** staff move that job to 14:30–15:30 on the requested day
- **THEN** the move is allowed

### Requirement: Customers cannot book sooner than the shop's minimum notice
The earliest a customer can book SHALL be now plus the shop's minimum notice, counted in real time and read on the shop's own clock, so it can fall on a later day and stays right across a clock change. A timed start SHALL be in time from that moment on; a drop-off day while that moment is before the day's drop-off window closes. A day before the shop's today SHALL offer nothing.

#### Scenario: Three hours' notice at 07:00
- **WHEN** it is 07:00 on 1 September 2026 in the UK and the notice is 3 hours
- **THEN** today's first start offered is 10:00 and tomorrow still starts at 09:00

#### Scenario: Notice past the end of the day
- **WHEN** the notice is 27 hours at 07:00 on 1 September
- **THEN** 1 September offers nothing and 2 September starts at 10:00

#### Scenario: Drop-off today
- **WHEN** the drop-off window is 09:00–10:00, it is 07:00 and the notice is 3 hours
- **THEN** today is not bookable and tomorrow is

#### Scenario: Booking too soon
- **WHEN** a customer books a start before now plus the notice
- **THEN** it is refused with "That's too soon for the shop - please choose a later time or day."

### Requirement: "Today" is the shop's own date, in its own time zone
Wherever the server needs the date or time of day, it SHALL use the shop's own clock and time zone, summer time included, not the server's or UTC: for minimum notice, for which days have passed, for when a scheduled mode change arrives and for which clashes a block reports. A live shop SHALL always use the real time; only a test may pin the clock.

#### Scenario: Half past midnight in the UK
- **WHEN** it is 00:30 on 9 September in the UK (still 8 September in UTC)
- **THEN** a booking for 8 September is refused with "That date has passed - please choose another day.", and a new block does not report a clash on 8 September

#### Scenario: Summer time
- **WHEN** it is 07:00 British Summer Time and the notice is 2 hours 30 minutes
- **THEN** the first start offered is 09:30

### Requirement: Staff can read and change the workshop settings
The server SHALL let staff read and save the workshop settings (a screen sets only the usual hours, open days and reserve): opening hours and days, the reserve, the booking mode and drop-off window, the arrival lead time, the length booked for "not sure", minimum notice, the time zone, whether prices show online and the shop's own booking terms. A save SHALL change only the settings it names.

#### Scenario: A new shop
- **WHEN** a shop is new
- **THEN** it has timed booking, a 09:00–10:00 drop-off window, a 30-minute arrival lead time, 60 minutes for "not sure", no reserve, two hours' notice, UK time, prices hidden and no terms of its own

#### Scenario: A later save
- **WHEN** staff switch to drop-off mode and later save only whether prices show online
- **THEN** the mode is still drop-off and the hours, window, lead time and "not sure" length are unchanged

### Requirement: The booking mode, the drop-off window and the lengths have limits
The booking mode SHALL be timed or drop-off, refused otherwise with "Booking mode must be either 'timed' or 'dropoff'". The drop-off window's times SHALL look like 09:00 and end after they start ("The drop-off window must end after it starts"). The arrival lead time SHALL be 0 to 240 whole minutes, the "not sure" length 1 to 480 ("The not-sure duration must be a whole number of minutes between 1 and 480"), and the reserve 0 to 480.

#### Scenario: Switching to drop-off
- **WHEN** staff choose drop-off with a window of 08:00 to 09:30
- **THEN** both are saved

#### Scenario: A window backwards
- **WHEN** staff set the window from 10:00 to 09:00
- **THEN** it is refused

### Requirement: A shop can schedule a change of booking mode
A shop SHALL be able to schedule a change to the other booking mode from a date, needing both parts, a real date from tomorrow on in the shop's time zone, and a different mode. Sending both parts as null, or one null and the other left out, SHALL cancel it; leaving both out SHALL keep it. Once its date arrives the new mode SHALL count from that date on, even before a save writes it in. Setting the mode directly to the scheduled one SHALL clear the schedule.

#### Scenario: Drop-off from a later date
- **WHEN** a timed shop schedules drop-off from a future date
- **THEN** it stays timed until then, and days from that date on are drop-off

#### Scenario: Cancelling the scheduled change
- **WHEN** staff save the new mode as null and leave the start date out, or send both as null
- **THEN** no change is scheduled any more

#### Scenario: A save that leaves the schedule out
- **WHEN** staff save only whether prices show online, leaving out the new mode and the start date
- **THEN** the scheduled change is kept

#### Scenario: Today, half a change, or the same mode
- **WHEN** staff schedule a change dated today, send only the mode, or schedule the mode the shop already uses
- **THEN** each is refused, with "A mode change must start tomorrow or later", "Give both the new mode and the date it starts, or neither to cancel" or "The shop already uses that mode"

#### Scenario: Another time zone
- **WHEN** it is 07:00 on 1 September in the UK and still 31 August in [a time zone behind the UK]
- **THEN** a UK shop cannot schedule a change from 1 September, and a shop in that time zone can

### Requirement: Minimum notice and the time zone have limits
Minimum notice SHALL be 0 minutes to 7 days in whole minutes, a number sent as text accepted, and refused otherwise (including null) with "Minimum notice must be between 0 minutes and 7 days"; leaving the field out SHALL keep the old value. An empty text ("") or text of only spaces SHALL be read as 0 and saved as no notice at all. The time zone SHALL be one the server recognises, refused otherwise with "That time zone isn't recognised".

#### Scenario: A week's notice in another time zone
- **WHEN** staff save 10080 minutes of notice and another recognised time zone ([time zone])
- **THEN** both are saved, and kept by later saves that leave them out

#### Scenario: Notice out of range
- **WHEN** staff send -1, 10081, 1.5, "abc" or null
- **THEN** each is refused with "Minimum notice must be between 0 minutes and 7 days"

#### Scenario: Empty notice saves zero
- **WHEN** staff send an empty text ("") as the minimum notice
- **THEN** it is saved as 0 minutes, with no refusal

### Requirement: Prices online and the shop's own booking terms are settings
Whether prices show online SHALL save as on or off. The shop's own booking terms SHALL be saved trimmed, kept when a save leaves them out, and reverted to the standard Wheelhouse terms by an empty value or a blank text; terms over 20,000 characters SHALL be refused with "Booking terms can be up to 20,000 characters", and anything not text with "Booking terms must be text".

#### Scenario: Blank terms
- **WHEN** staff save terms of only spaces
- **THEN** the shop has no terms of its own again

### Requirement: New job warns when the work won't fit
Once work is chosen on New job, the form SHALL compare the work's length with the chosen mechanic's free time from the chosen start, to the end of that free stretch, on that day (decision 23). When the work is longer, the form SHALL show "Only [n] minutes free at [time] — this job needs [m]. Choose another time, or save anyway and the diary will show the overlap.", or "No free time at [time] — this job needs [m]. …" when the start is in busy time, with a "Find the next free [m] minutes" button. Save job SHALL stay available. The button SHALL move the job to the same mechanic's first free stretch long enough for the work, starting on the quarter hour, later that day or on a following day within 60 days counting the chosen one, keep the mechanic, put the focus on the new time, and the warning SHALL go (Jack, 15 Oct); when there is none it SHALL say "[mechanic] has no free [m] minutes in the next 60 days.", and when the search fails "Couldn't find free time — try again." Free time here is what the shop's capacity gives as free stretches: it leaves out blocks, closures, days off and timed jobs, but not untimed jobs, the Shared queue's share or the reserve. The Shared queue SHALL get no warning.

#### Scenario: Work longer than the gap
- **WHEN** staff choose a 90-minute Standard service at 10:00 on Tue 6 Oct for Jo Taylor, who is free 09:00–10:30 and from 12:00
- **THEN** the form shows "Only 30 minutes free at 10:00 — this job needs 90. Choose another time, or save anyway and the diary will show the overlap." and Save job is still offered

#### Scenario: Work that fits
- **WHEN** staff choose a 30-minute Brake adjust at the same time
- **THEN** there is no warning

#### Scenario: Finding the next free time the same day
- **WHEN** staff press "Find the next free 90 minutes"
- **THEN** the job moves to Tue 6 Oct 12:00–13:30 with Jo Taylor and the warning goes

#### Scenario: Finding the next free time on a later day
- **WHEN** Jo has no 90-minute gap left on Tue 6 Oct and is free all of Wed 7 Oct, and staff press "Find the next free 90 minutes"
- **THEN** the job moves to Wed 7 Oct 09:00–10:30 with Jo Taylor

#### Scenario: Saving anyway
- **WHEN** staff save with the warning showing
- **THEN** the job is saved at the time chosen

#### Scenario: The Shared queue
- **WHEN** the mechanic is the Shared queue
- **THEN** there is no warning

#### Scenario: The automatic choice after a move
- **WHEN** Jo Taylor was chosen automatically for Tuesday and "Find the next free 90 minutes" moves the job to Wed 7 Oct
- **THEN** the form still says "Mechanic chosen automatically: most free time on Tuesday." and the focus is on the new time

### Requirement: Choosing a time for New job highlights the slot under the pointer
While New job is choosing a time, the slot under the mouse pointer SHALL show as a solid block in the accent colour with its start time, snapped as a click would be, and SHALL go when the pointer leaves the column (drawn as new-job-pick; Jack, 16 Oct). It SHALL NOT show outside choosing a time, for a touch (so a tap picks the time first time), or left over from the last time New job chose a time.

#### Scenario: Pointing at Tuesday 10:00
- **WHEN** staff press New job and move the pointer over Tuesday at 10:00
- **THEN** a highlighted slot reading "10:00" shows there, and goes when the pointer leaves Tuesday

#### Scenario: A touch screen
- **WHEN** staff tap Tuesday at 10:00 while choosing a time
- **THEN** no slot is highlighted and the tap picks the time

#### Scenario: Not choosing a time
- **WHEN** staff move the pointer over the diary without pressing New job
- **THEN** no slot is highlighted

### Requirement: Everything clickable shows the pointing finger
Every button, control acting as a button, select, and label for a field in the new app SHALL show the pointing-finger cursor, as links do, unless it is disabled (Jack, 16 Oct). A job that can be dragged SHALL keep its open-hand cursor.

#### Scenario: A toolbar button
- **WHEN** the pointer is over "Next week" or "New job"
- **THEN** it shows the pointing finger

#### Scenario: A job that can be moved
- **WHEN** the pointer is over a job that can be dragged
- **THEN** it shows the open hand

### Requirement: New job's customer search drops down without resizing the form
On New job, the customers matching what is typed, or "No customer matches “[text]”.", SHALL drop down over the form just under the search box, so the New job pop-up keeps its size while staff type (Jack, 16 Oct). The list SHALL close when a customer is chosen, on Escape while it shows, or when the focus leaves the search, and SHALL open again when staff type. Choosing a result SHALL work in every browser, Safari and iPad included. A screen reader SHALL hear how many customers were found, or that none match.

#### Scenario: A name that matches no one
- **WHEN** staff type "zz" into "Find customer by name, phone or email"
- **THEN** "No customer matches “zz”." shows under the box and the New job pop-up is the same height as before

#### Scenario: Escape closes the list
- **WHEN** the list is showing and staff press Escape in the search box
- **THEN** the list closes, "zz" stays in the box, and the New job form stays open

### Requirement: The diary's passing messages float without moving the page
New job's "Choose a time for the new job." bar and a refused move's "Couldn't move …" message SHALL float at the bottom of the screen over the diary, so the diary does not move when they appear or go (Jack, 16 Oct). The page SHALL keep room at its foot while they show, so they never hide the last hour of the diary. On a phone they SHALL sit at the foot of the page above the chosen Waiting card's bar, never over it. Pressing New job SHALL put the focus on "Enter a time instead". The "Couldn't move …" message SHALL have a "Close the message" button that removes it, and SHALL open under a job's menu, not over it.

#### Scenario: Pressing New job
- **WHEN** staff press New job
- **THEN** "Choose a time for the new job." shows at the bottom of the screen and the diary stays where it was

#### Scenario: Closing a refused move's message
- **WHEN** a move is refused and staff press "Close the message"
- **THEN** the message goes

### Requirement: Waiting for you is boxed in as a panel
On a computer or tablet, "Waiting for you" SHALL sit in a panel in the app's soft grey, its cards light, with a thin border and rounded corners, its heading inside and the count shown as a badge; a screen reader SHALL hear "Waiting for you ([n])" (Jack, 16 Oct).

#### Scenario: Two things waiting
- **WHEN** two bookings are waiting
- **THEN** the panel's heading reads "Waiting for you" with a badge "2", and a screen reader hears "Waiting for you (2)"

### Requirement: A chosen Waiting card says how to open it
Once a card in "Waiting for you" is chosen on a computer or tablet, a note under the cards SHALL say "Double-click a card to open it.", or "Tap the card again to open it." when the card was chosen by a tap (drawn on diary; decision 14).

#### Scenario: Choosing with a mouse
- **WHEN** staff click Lena Fox's card
- **THEN** the note reads "Double-click a card to open it."

#### Scenario: Choosing with a tap
- **WHEN** staff tap Lena Fox's card
- **THEN** the note reads "Tap the card again to open it."

### Requirement: The diary is finger-sized on a touch screen
On a touch screen, the Week and Day buttons and a chosen Waiting card's Open button SHALL be at least 44 pixels tall, and the Waiting cards' words SHALL be larger, as drawn for the tablet.

#### Scenario: A tablet
- **WHEN** the diary is opened on a tablet
- **THEN** Week and Day are at least 44 pixels tall

### Requirement: A change request can open the full job
The change request pop-up SHALL offer "Open full job" beside Decline, which closes the pop-up and opens the job page (drawn on request-change).

#### Scenario: Opening Oliver Chen's job
- **WHEN** staff open Oliver Chen's change request and press "Open full job"
- **THEN** the request closes and the job page for his Full service opens

### Requirement: Week/Day sits with the dates
On a computer or tablet the Week/Day switch SHALL sit next to the date navigation at the left of the toolbar, with the people chips and New job at the right (decision 60's order; Jack, 16 Oct).

#### Scenario: The toolbar
- **WHEN** staff open the diary on a computer
- **THEN** the Day button sits right beside "Previous week"

### Requirement: The phone has a way back to today
On a phone, when today isn't the day on screen, a "Today" button SHALL show beside the week arrows; pressing it SHALL show today, and it SHALL go (Jack, 16 Oct). On a phone 360 pixels wide it SHALL fit without the page scrolling sideways: the row tightens and the people chip shortens its text with "…" if it must.

#### Scenario: Another week
- **WHEN** a phone shows Tuesday 6 October and today is another day
- **THEN** "Today" shows, and pressing it shows today and the button goes

### Requirement: Diary labels are at least 12 pixels
Every label on the diary and its pop-ups SHALL be at least 12 pixels on every screen (Jack, 16 Oct). A job block too short for two lines SHALL show the bike only, its job staying in its description and summary.

#### Scenario: A half-hour job
- **WHEN** a Giant Escape is booked for a half-hour Safety check
- **THEN** its block shows "Giant Escape" only, and an hour-long job shows its title too

### Requirement: The diary fits an upright tablet
Between phone width and computer width (an upright tablet), the diary's toolbar SHALL sit on two rows, Week/Day with the dates above, the people chips, a "Waiting" button with its count and New job below; "Waiting for you" SHALL be that button, opening the same Waiting list as the phone, and the week SHALL take the full width (Jack approved the drawing, 16 Oct). A card chosen from that list SHALL show the phone's chosen-card bar, with Open, at the foot of the page, with any passing message above it. On a computer the Waiting column SHALL stay beside the diary.

#### Scenario: An iPad held upright
- **WHEN** the diary is opened 834 pixels wide
- **THEN** there is no Waiting column, New job sits on the row below Week/Day, and "Waiting" opens the Waiting list

#### Scenario: A computer
- **WHEN** the diary is opened 1280 pixels wide
- **THEN** "Waiting for you" is a column beside the diary and there is no Waiting button

### Requirement: By mechanic columns stay readable on a phone
On a phone, each "By mechanic" column SHALL be at least 96 pixels wide; when they don't all fit, the diary SHALL scroll sideways inside its own area, with the times staying put and the mechanics' names moving with their columns, and the page SHALL NOT scroll sideways (Jack, 17 Oct). A job dragged there SHALL only land on the part of a column that can be seen; let go over the times, and it stays with its own mechanic.

#### Scenario: Six mechanics on a 360px phone
- **WHEN** a 360-pixel phone shows By mechanic for six mechanics
- **THEN** each column is at least 96 pixels wide, the diary area swipes sideways, and the page itself doesn't

### Requirement: The old app's Workshop tab opens the new diary
The old app's Workshop tab, and any old `#workshop` address, SHALL open the new diary at `/workshop/diary` (Jack, 18 Oct, `docs/decisions/2026-10-18-retire-old-diary.md`). The old job form, still opened from an order, SHALL list the shop's mechanics without the diary having been opened first.

#### Scenario: An old bookmark
- **WHEN** staff open the old app at `#workshop`
- **THEN** the new diary opens at `/workshop/diary`

#### Scenario: The tab
- **WHEN** staff click Workshop in the old app's top bar
- **THEN** the new diary opens

#### Scenario: A job opened from its order
- **WHEN** staff open an order's workshop job with "View / edit workshop job"
- **THEN** the job form's mechanic list has the shop's mechanics

### Requirement: The old job form refuses a save on a job changed elsewhere
The old job form, opened from an order, SHALL refuse a save or "Mark complete" on a job someone else changed after it opened, say "This job changed while you were looking at it." and close (kept from the retired review pop-up requirement, which also said this).

#### Scenario: Marking complete
- **WHEN** staff press "Mark complete" on a job someone else saved after the form opened
- **THEN** it says "This job changed while you were looking at it." and the form closes

#### Scenario: Saving
- **WHEN** staff save a job someone else saved after the form opened
- **THEN** it says "This job changed while you were looking at it." and the form closes

### Requirement: Shared queue shows only the jobs no mechanic has yet
The diary SHALL offer "Shared queue" after the mechanics: a button on desktop and tablet, and the last line of the phone's "whose jobs" list (Jack, 18 Oct, `docs/decisions/2026-10-18-old-diary-features.md` answer 5). Picked, the diary SHALL show only the jobs with no mechanic. The Day view SHALL be one column of them, named "Shared queue", and the choice SHALL be kept in the address as `?who=shared`. With Week, Day and Month and four people buttons, the toolbar SHALL stay one row on a screen 1366 pixels wide; on a narrower screen the people buttons and New job SHALL move to a second row, as on a tablet (Jack, 18 Oct, when Month was added).

#### Scenario: The week
- **WHEN** staff pick Shared queue in a week where Sam Reed's Specialized Sirrus has no mechanic and Maya Patel's Trek Domane is Alex Morgan's
- **THEN** the Specialized Sirrus shows and the Trek Domane does not

#### Scenario: The Day view
- **WHEN** staff open the Day view with Shared queue picked
- **THEN** there is one column, named "Shared queue", and no column for each mechanic

#### Scenario: A phone
- **WHEN** staff open the phone's "whose jobs" list
- **THEN** its last line is "Shared queue", and picking it shows only the jobs with no mechanic

#### Scenario: A 1366-pixel screen
- **WHEN** the diary is open on a screen 1366 pixels wide
- **THEN** the view switch, the dates, Everyone, each mechanic, Shared queue and New job sit on one row

#### Scenario: A 1280-pixel screen
- **WHEN** the diary is open on a screen 1280 pixels wide with two mechanics
- **THEN** the people buttons and New job sit on a second row, under the view switch and the dates, and nothing scrolls sideways

### Requirement: A job's length changes by its bottom edge
Staff SHALL be able to make a timed job longer or shorter by dragging its bottom edge, in 15-minute steps, no shorter than 15 minutes and ending no later than closing time (Jack, 18 Oct, `docs/decisions/2026-10-18-old-diary-features.md` answer 2). The new times and length SHALL show while it changes, and letting go SHALL save the new end time with the version the diary saw.

#### Scenario: Dragging with a mouse
- **WHEN** staff drag the bottom edge of a 10:00–11:00 Brake service down two half-hour rows
- **THEN** it reads "10:00–12:00 · 2 hours" while dragging, and letting go saves the end time 12:00

#### Scenario: The limits
- **WHEN** staff shorten a job below 15 minutes or stretch it past closing time
- **THEN** it stops at 15 minutes, or at closing time

### Requirement: The edge follows the pointer fairly
With a mouse the edge SHALL work on any job shown on its own; a job in a stack uses Change length. The end SHALL follow the edge wherever on it the press was, a press that moves less than 4 pixels SHALL change nothing, and a job SHALL stop at its own day's closing time even when the grid runs later for another day.

#### Scenario: Grabbed at the top of the edge
- **WHEN** staff grab the top of a 14:00–15:00 job's edge and drag it down two half-hour rows
- **THEN** it reads "14:00–16:00 · 2 hours"

#### Scenario: A shorter day
- **WHEN** Tuesday closes at 16:00, other days at 18:00, and staff lengthen a Tuesday 10:00 job as far as it goes
- **THEN** it stops at 16:00

### Requirement: Change length in the job's menu, for touch and the keyboard
On a touch screen the grip SHALL show only after "Change length" in the job's menu (opened by holding the job). It SHALL be at least 44 pixels tall, and a tap elsewhere SHALL leave the length as it was. From the keyboard, "Change length", then up, down, Enter and Escape, SHALL do the same. A booking request or a cancelled booking SHALL NOT offer it.

#### Scenario: A tablet
- **WHEN** staff on a tablet hold a job and choose "Change length"
- **THEN** a grip at least 44 pixels tall shows on its bottom edge; before that, none shows

#### Scenario: The keyboard
- **WHEN** staff choose "Change length" for the 10:00–11:00 Trek Domane, press down twice and Enter
- **THEN** its end time is saved as 11:30 and "Trek Domane now 10:00–11:30." is read out

#### Scenario: A booking request
- **WHEN** staff open a booking request's menu
- **THEN** it has no "Change length"

### Requirement: Month view shows each day's first jobs
The diary SHALL offer "Month" beside Week and Day on desktop and tablet (Jack, 18 Oct, `docs/decisions/2026-10-18-old-diary-features.md` answer 1). It SHALL show the weeks that hold the month, Monday to Sunday, with other months' days dimmed, and each day's first three jobs, earliest first, as start time and bike coloured by status, then "+[n] more". The arrows SHALL move a month at a time.

#### Scenario: A busy day
- **WHEN** Tuesday 6 October has jobs at 09:00, 10:00 and 14:00 and one with no time
- **THEN** its day shows 09:00 Cube Attain, 10:00 Trek Domane, 14:00 Giant Escape and "+1 more"

#### Scenario: The next month
- **WHEN** staff press Next month from October 2026
- **THEN** the diary shows "November 2026", from Monday 26 October to Sunday 6 December

### Requirement: A month's day opens its list or the Day view
"+[n] more" SHALL open the day's list: each job's time, bike and job, status, customer and mechanic, and "Open this day in the Day view". A job SHALL open its page, and a day's date SHALL open that day in the Day view. On a touch screen a tap anywhere in a day SHALL open its list, with rows at least 44 pixels tall, and its jobs SHALL NOT be tapped one by one.

#### Scenario: The day's list
- **WHEN** staff press "+1 more" on Tuesday 6 October
- **THEN** a list titled "Tuesday 6 October" shows all four jobs, and its last line opens that day in the Day view

#### Scenario: A tablet
- **WHEN** staff on a tablet tap anywhere in Thursday 8 October
- **THEN** that day's list opens

### Requirement: A phone chooses a day from the month
On a phone the week label SHALL open "Choose a day", the month with each day's number of jobs, and a tap on a day SHALL go to that day.

#### Scenario: Choosing a day
- **WHEN** staff tap the week label and then Monday 5 October, which has one job
- **THEN** the diary shows Monday 5 October

### Requirement: The job menu opens the job's order in the till
"Job actions" SHALL offer "Open in the till", opening the till with the job's order (Jack, 18 Oct). It SHALL be greyed with its reason underneath: "Not booked yet" on a booking request, "Already paid" once the order is paid, "No order on this job" without one.

#### Scenario: A booked job
- **WHEN** staff choose "Open in the till" on a booked job with an unpaid order
- **THEN** the till opens with that job

#### Scenario: A booking request
- **WHEN** staff open a booking request's menu
- **THEN** "Open in the till" is greyed, reading "Not booked yet"

### Requirement: The diary menu prints a paid job's receipt
The job menu SHALL offer "Print receipt", which prints the receipt of the sale that paid the job's order (Jack, 18 Oct, `docs/decisions/2026-10-18-print-receipt.md`). Until the order is paid it SHALL be greyed with "Not paid yet" (`diary-menu-job`), or "Order cancelled" once the order is cancelled.

#### Scenario: A paid job
- **WHEN** staff open WH-1042's menu after its order is paid and choose Print receipt
- **THEN** its receipt prints

#### Scenario: Not paid yet
- **WHEN** a job's order is still open, or it is a booking request
- **THEN** Print receipt is greyed with "Not paid yet"

### Requirement: Staff offer another time from the diary
The request pop-up SHALL offer "Offer another time", which puts the diary in pick mode for the request's length; a free time SHALL open a pop-up with the time, a message to the customer, and Offer this time. An offered booking SHALL show in the diary as "Time offered", with nothing to answer (Jack, 20 Oct).

#### Scenario: Picking a time
- **WHEN** Jo presses Offer another time on Sam's request and clicks Friday at 12:00 in Alex's column
- **THEN** the offer pop-up shows "Friday 18 September, 12:00 · Alex Morgan" with Message to Sam

### Requirement: Staff decline a request with a message
Declining a booking request SHALL ask staff to explain what the customer can do next, in a message started for them, and send it with the decline (Workshop day 15; Jack, 20 Oct).

#### Scenario: Declining Sam's request
- **WHEN** Jo presses Decline on Sam's request, edits the message and presses Decline & notify customer
- **THEN** the request is declined and the message kept for Sam

### Requirement: Staff can offer a different time or decline an offered booking
A booking whose offered time is waiting for the customer SHALL open, from its diary block, a pop-up showing the offered time, the message sent with it and that it waits for the customer, with "Offer a different time" and "Decline" and no Accept (Jack, 20 Oct; drawn as request-offered, request-offered-decline).

#### Scenario: Offer a different time
- **WHEN** staff choose Offer a different time and offer another free time
- **THEN** the new time replaces the first offer, and the offer still says the day the customer first asked for

#### Scenario: Decline
- **WHEN** staff decline it with a message
- **THEN** the booking is declined, the offered time is let go, and the customer's page shows the message
