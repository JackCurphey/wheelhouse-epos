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
- **WHEN** staff open the diary on the week of 5 October 2026 and Maya Patel's Trek Domane is booked for "Brake service" on Tuesday 6 October, 10:00 to 11:00
- **THEN** the toolbar reads "5–11 October 2026" and the block sits in Tuesday 6 October's column showing "Trek Domane" and "Brake service"

#### Scenario: What a screen reader hears
- **WHEN** a screen reader reaches that block
- **THEN** it hears "Trek Domane, Brake service, Maya Patel, WH-1001, Expected, 10:00–11:00"

#### Scenario: Next week
- **WHEN** staff press Next week
- **THEN** the diary shows "12–18 October 2026" with that week's jobs

### Requirement: The Day view shows one column per mechanic
On a computer or tablet, staff SHALL be able to switch between Week and Day. The Day view SHALL show one day with a column for each active mechanic, and SHALL write the status word on each block. When a timed job on that day has no mechanic and no single mechanic is chosen, the Day view SHALL add a "Not assigned yet" column.

#### Scenario: Switching to Day
- **WHEN** staff choose Day on Tuesday 6 October
- **THEN** the toolbar reads "Tuesday 6 October", Alex Morgan and Jo Taylor each have a column, and Alex Morgan's column shows "Trek Domane" with "Brake service · Expected"

### Requirement: Staff can show one mechanic's jobs
The diary SHALL offer people chips: Everyone, then each active mechanic. Choosing a mechanic SHALL show only that mechanic's jobs; a booking request with no mechanic yet SHALL show only under Everyone.

#### Scenario: Choosing Alex Morgan
- **WHEN** staff choose the Alex Morgan chip
- **THEN** Alex Morgan's Trek Domane still shows, while Jo Taylor's Brompton C Line and the unassigned request for the Specialized Sirrus do not

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
- **WHEN** Priya Shah's Giant Escape booking has been declined
- **THEN** it is not drawn

#### Scenario: A customer's cancellation
- **WHEN** Aisha Khan cancelled her Cannondale Quick booking and nobody has marked it seen
- **THEN** it shows struck through, reading "Cancelled"

### Requirement: Jobs with no time sit in the No time row
A job with no start time SHALL NOT be drawn on the time grid. In the Week view on a computer or tablet it SHALL appear as a chip showing only the bike, in one "No time" row above the grid for the whole week; the chip SHALL be plain text that cannot be opened or moved. The Day view SHALL show untimed jobs nowhere. On a phone the row SHALL show the day's untimed jobs only when one column shows, and read "None" when there are none.

#### Scenario: An untimed job
- **WHEN** Tom Hale's Ribble CGR is booked for Tuesday with no time
- **THEN** "Ribble CGR" sits in the Week view's No time row

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

#### Scenario: Two jobs at 10:00
- **WHEN** Trek Domane's Standard service (WH-1042) and Specialized Sirrus's Puncture repair (WH-1043) both start at 10:00 on Tuesday 6 October
- **THEN** they show as one stack, and choosing it opens "2 jobs at 10:00" with "Tuesday 6 October · choose one to open" and a tile for each

### Requirement: A job over several days has a block on each day
A job worked over more than one day SHALL have a block on each of its days, at that day's time and mechanic, each saying "Day [n] of [total]".

#### Scenario: A two-day frame rebuild
- **WHEN** Maya Patel's Trek Domane AL 3 "Frame rebuild" (WH-1050) is booked 10:00 to 12:00 on Monday 5 and Tuesday 6 October
- **THEN** Monday shows it as "day 1 of 2" and Tuesday shows "Day 2 of 2 · Frame rebuild"

### Requirement: A customer's change request shows where the customer wants to go
A booking with a customer's change request waiting SHALL show amber at its current time, and a dashed outline reading "Requested [time]" at the time the customer asked for, when that time falls in a day and column on screen. A screen reader SHALL hear "[bike] asks to move here: [time]".

#### Scenario: Oliver Chen asks to move
- **WHEN** Oliver Chen's Brompton C Line is booked at 10:00 on Monday 5 October and he asks for 14:00 the same day
- **THEN** the block reads Change requested and Monday shows "Brompton C Line asks to move here: 14:00–15:00"

### Requirement: On a phone the diary is one day at a time
Below tablet width the diary SHALL show one day, chosen from a strip of the week's seven days in place of the Week and Day switch, with arrows that move a week and keep the weekday. One people chip SHALL choose Everyone (one column), By mechanic (a column each) or one person. "Waiting" with its count SHALL sit in the top bar and open the list as a sheet.

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

### Requirement: Staff can move a job by dragging it or from the keyboard
Staff SHALL be able to drag a timed job to another time or day, or, in the Day view, to another mechanic, snapped to 15 minutes and kept inside the grid's hours. From the keyboard, M SHALL pick a job up, the arrows move it 15 minutes or a column, Enter or Space save it and Escape put it back, each step read out. Saving SHALL send the version the diary saw, and the mechanic only when it changed. A later day of a job SHALL move on its own. A click or Enter that is not a move SHALL open the job.

#### Scenario: Moving from the keyboard
- **WHEN** staff press M on the Trek Domane block (Tuesday 6 October, 10:00–11:00), press the down arrow twice and the right arrow once
- **THEN** it reads "Moving Trek Domane. Wed 7 Oct, 10:30–11:30.", and Enter saves that day and time with the version the diary saw

#### Scenario: Escape
- **WHEN** staff pick the job up, move it and press Escape
- **THEN** it reads "Move cancelled. Trek Domane stays at Tue 6 Oct, 10:00–11:00." and nothing is saved

#### Scenario: Another mechanic in the Day view
- **WHEN** staff pick the job up in the Day view and press the right arrow
- **THEN** it reads "Moving Trek Domane. Tue 6 Oct, 10:00–11:00, Jo Taylor." and Enter saves it to Jo Taylor

#### Scenario: Moving a second day
- **WHEN** staff move day 2 of the Frame rebuild to Wednesday 7 October
- **THEN** only day 2 moves

### Requirement: A move the shop's rules refuse is put back, and says why
A move SHALL be checked against the shop's rules for a job's day and time (see `workshop-jobs`). When it is refused, the job SHALL stay where it was and the diary SHALL show "Couldn't move [bike]: " and the server's reason, or "This job changed while you were looking at it." and reload when someone else changed the job first. A booking request, a customer's cancellation and a job with no time SHALL NOT be movable on the diary.

#### Scenario: A clash with another job
- **WHEN** staff drop a job over another of the same mechanic's jobs
- **THEN** the diary shows "Couldn't move Trek Domane: That mechanic is already booked over part of that window - please choose another time."

#### Scenario: Someone else got there first
- **WHEN** another member of staff changed the job after this diary loaded
- **THEN** the diary shows "Couldn't move Trek Domane: This job changed while you were looking at it."

#### Scenario: A booking request
- **WHEN** the Specialized Sirrus booking is still a request
- **THEN** it cannot be picked up or dragged

### Requirement: Dropping a job on the customer's requested time accepts the change
When a job with a customer's change request waiting is saved onto exactly the requested day, start time and mechanic, the change SHALL be accepted, whatever the job's length. In the Week view, or a column for everyone, a drop on exactly the requested day and start time SHALL send the mechanic the customer asked for. Saved anywhere else, the request SHALL stand, with both the job's own time and the requested time held.

#### Scenario: Dropped on the requested start
- **WHEN** a booking at 10:00 whose customer asked for 14:00 on another day is saved to that day at 14:00 to 15:30
- **THEN** it is confirmed at 14:00 to 15:30, no request remains, and one hold is kept, at the new time

#### Scenario: Dropped elsewhere
- **WHEN** the same booking is moved to 12:00 on its own day
- **THEN** it still reads Change requested, held at 12:00 and at the requested 14:00

#### Scenario: Dropped on the outline in the Week view, for another mechanic
- **WHEN** the customer asked to move from Alex Morgan to Jo Taylor and staff drop the job on the dashed outline in the Week view
- **THEN** the move is sent with Jo Taylor as the mechanic, so the change is accepted

### Requirement: New job starts by choosing a time on the diary
New job SHALL turn the diary to "Choose a time for the new job.", with "Enter a time instead" and Cancel. A click on the grid SHALL open the New job form at that time, snapped to 15 minutes; Cancel SHALL leave the diary as it was. The form SHALL have no date or time field. In the Day view the clicked column's mechanic SHALL be chosen, or Shared queue in the "Not assigned yet" column. Otherwise the form SHALL choose a mechanic as the next requirement says.

#### Scenario: Clicking Tuesday at 10:00
- **WHEN** staff press New job and click Tuesday 6 October at 10:00, where Alex Morgan already has a job and Jo Taylor has none
- **THEN** the form opens reading "Tue 6 Oct · 10:00 · Jo Taylor" with Jo Taylor chosen

#### Scenario: Cancel
- **WHEN** staff press New job and then Cancel
- **THEN** the New job button returns and no form opens

#### Scenario: Enter a time instead
- **WHEN** staff press "Enter a time instead" in the Week view
- **THEN** the form opens at the grid's first hour on the date in the page address, with no way to change the date or time in the form

### Requirement: New job chooses the mechanic with the fewest timed minutes
Outside a mechanic's own column, New job SHALL choose, among the mechanics whose working days include that weekday, the one with the fewest minutes of timed jobs on that day in the diary, counting cancelled, declined and expired bookings too; on a tie, the first in the list. If nobody works that weekday, it SHALL choose from everyone. The form SHALL say "Mechanic chosen automatically: most free time on [weekday]."

#### Scenario: Jo Taylor has nothing booked
- **WHEN** both mechanics work Tuesdays and only Alex Morgan has a timed job on Tuesday 6 October
- **THEN** Jo Taylor is chosen

### Requirement: The New job form finds the customer and fills in the work
The New job form SHALL find a customer by name, phone or email and offer their bikes, choosing an only bike for them. The work SHALL be chosen as Full service or Individual service pills listing only the shop's active services; choosing one SHALL fill the job title and the job's length. New bike build or pre-delivery check SHALL make the customer optional. The mechanic SHALL be chosen from pills that include Shared queue, and the starting status SHALL be Booked or Waiting for parts.

#### Scenario: A Standard service
- **WHEN** staff choose Full service and then "Standard service · 90 min"
- **THEN** the title becomes "Standard service" and the form reads "Tue 6 Oct · 10:00–11:30 · Jo Taylor"

#### Scenario: A retired service
- **WHEN** a service is no longer active
- **THEN** it is not offered

### Requirement: Saving a new job
Save job SHALL create the job with what the form holds and, when work was chosen, its planned length; with no work chosen the job SHALL be an hour long. A title SHALL be needed, and a customer unless it is a new bike build. If the server refuses, the form SHALL show its words and stay open. "The bike is here now" SHALL book the bike in straight after saving, unless the job was created with the bike already in the shop.

#### Scenario: Maya Patel's Standard service
- **WHEN** staff find "Maya", choose Maya Patel, choose "Standard service · 90 min" and save
- **THEN** a job is created for Maya Patel's Trek Domane AL 3 on Tuesday 6 October from 10:00 to 11:30 with Jo Taylor, booked, with a planned length of 90 minutes

#### Scenario: The bike is here now
- **WHEN** staff turn on "The bike is here now" and save with the starting status Booked
- **THEN** the job is created and then booked in

#### Scenario: The bike is here now, waiting for parts
- **WHEN** staff turn on "The bike is here now" and save with the starting status Waiting for parts
- **THEN** the job is created with the bike already in the shop, no book-in is sent, and the form closes

#### Scenario: No customer
- **WHEN** staff save a job titled "PDI" with no customer and New bike build off
- **THEN** the form says "Give the job a title, and choose a customer or turn on New bike build."

### Requirement: Staff can open a job's menu, summary and overview from the diary
Right-clicking a job, a press and hold on a touch screen, or the Menu key or Shift+F10, SHALL open "Job actions" with Open job and View overview; holding the right mouse button SHALL open the overview straight away. Resting the mouse on a job for about 0.6 seconds (at once when motion is reduced) SHALL show its summary. The summary and View overview SHALL show the job, customer and bike, the notes, the work and parts, and the cost.

#### Scenario: View overview
- **WHEN** staff right-click Maya Patel's Trek Domane (WH-1042, Standard service) and choose View overview
- **THEN** it shows "Maya Patel · Trek Domane", "Squeaky brakes", "Front brake rubs at speed", "Brake pads (pair)" and £93.00, with any quote line the customer declined struck through

#### Scenario: Nothing on the order yet
- **WHEN** staff view the overview of a job with nothing on its order
- **THEN** it says "No work or parts yet." and £0.00

#### Scenario: From the keyboard
- **WHEN** staff press Shift+F10 on a job, move with the arrow keys and press Escape
- **THEN** the menu opens on Open job, moves to View overview, closes, and focus returns to the job

### Requirement: "Waiting for you" lists what customers are waiting on staff for
"Waiting for you" SHALL list, for the signed-in shop only: new online booking requests (not requests staff made themselves); customers' change requests; and bookings the customer cancelled, until someone marks them seen (never the shop's own cancellations). Items SHALL come oldest first by when each arrived. Each SHALL carry the job number, day, time and mechanic, the customer and the services in order; a change request SHALL also carry where the customer wants it.

#### Scenario: A new online booking
- **WHEN** Wendy Waiting books "Test repair" and "Test quick" with Sam at 10:00
- **THEN** it is listed as a new booking from 10:00 to 11:30 with Sam, for Wendy Waiting, with those two services, arriving when the booking was made

#### Scenario: A change request
- **WHEN** a confirmed booking with Sam at 10:00 asks to move to 14:00 with Alex on another day
- **THEN** it is listed as a change request from 10:00–11:00 with Sam to 14:00–15:00 with Alex

#### Scenario: Oldest first
- **WHEN** a cancellation arrived on 8 September, a change request on 9 September and a new booking on 10 September
- **THEN** they are listed in that order

#### Scenario: Another shop
- **WHEN** another shop receives an online booking
- **THEN** it never appears in this shop's list

### Requirement: The diary's Waiting column chooses and opens what is waiting
On a computer or tablet the diary SHALL show "Waiting for you ([n])" beside the grid, refreshed every minute, one card per item with its kind, the customer, and the services and time or the move; with nothing waiting it SHALL say "Nothing waiting." One click on a card SHALL choose it: the diary moves to that job's week, shows Everyone, marks its block, and the card shows Open. Open, or a double-click, SHALL open the request; a second click or tap SHALL NOT.

#### Scenario: Choosing Lena Fox's request
- **WHEN** staff click Lena Fox's card, booked for 14 October
- **THEN** the diary shows "12–18 October 2026" and the Cube Attain block is marked "chosen from Waiting for you"

#### Scenario: A card's words
- **WHEN** Sam Reed has asked for a Puncture repair on Friday 9 October, 10:00–10:45 (the Week view's example)
- **THEN** his card reads "New booking request", "Sam Reed" and "Puncture repair · Fri 9 Oct, 10:00–10:45"

#### Scenario: Double-click
- **WHEN** staff double-click Aisha Khan's cancellation card
- **THEN** its pop-up opens straight away

### Requirement: Staff answer a new booking request in a pop-up
A new booking request SHALL open in a pop-up headed "[customer] · [bike]" with "Pending request", what the customer told us (or "No message from the customer."), the service and the time asked for. Accept SHALL accept the booking with the version the pop-up saw, close the pop-up and refresh the diary. Decline SHALL ask first, with Decline booking to confirm and Keep booking to back out. Accepting and declining follow `workshop-jobs`.

#### Scenario: Sam Reed's request
- **WHEN** staff open Sam Reed's request for a Puncture repair on Friday 9 October, 10:00–10:45
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
- **WHEN** staff accept a request to move a 10:00 booking with Sam to 14:00 on another day
- **THEN** the booking is confirmed at 14:00–15:00 on that day with no request left, and it holds only that time

#### Scenario: The time has gone
- **WHEN** another job now covers 14:30 to 15:30 with Sam on the requested day
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
- **WHEN** staff add the note "Rang to confirm" from the old form while a change request waits
- **THEN** the booking still reads Change requested and is still listed in "Waiting for you"

#### Scenario: Saving the old pending status
- **WHEN** staff save the status "pending" from the old form while a change request waits
- **THEN** the request ends and only the booking's own time stays held

#### Scenario: The shop cancels a requested booking
- **WHEN** staff cancel a booking whose customer asked to move it
- **THEN** no request and no held time remain

### Requirement: The old app's Workshop diary shows what is waiting
The old app's Workshop diary SHALL show a "Waiting for you ([n])" column, oldest first, each card with its kind, the customer and job number, the services, when (or the move, naming a new mechanic) and how long ago it arrived, or "Nothing waiting". It SHALL check for new items every minute without a click, and stop checking at logout. Clicking a card SHALL jump to the job's week and highlight it.

#### Scenario: Arrival wording
- **WHEN** a change request from Wednesday 7 October at 10:00 to Friday 9 October at 14:00 arrived 40 minutes ago
- **THEN** its card reads "Wed 7 Oct 10:00 → Fri 9 Oct 14:00" and "Arrived 40 minutes ago"

#### Scenario: A move to another mechanic
- **WHEN** the same request also moves the job to Jo
- **THEN** the card reads "Wed 7 Oct 10:00 → Fri 9 Oct 14:00 with Jo"

#### Scenario: A new booking arrives
- **WHEN** a customer books online while the old diary is open
- **THEN** the card appears within a minute without a click

### Requirement: The old app answers what is waiting in a review pop-up
In the old app a job that is waiting SHALL open a review pop-up headed "New online booking", "Change request" or "Cancelled by customer" with the job number, showing the customer's answers grouped under each service, their photos and notes, with Open full job and either Accept and Decline (a new booking's Decline asking first) or Seen. A diary drag on a job someone else changed SHALL be refused and the diary reload; marking such a job complete from its form SHALL be refused and the form close.

#### Scenario: A heading
- **WHEN** staff open the change request for WH-1038
- **THEN** the pop-up is headed "Change request · WH-1038"

#### Scenario: An old copy
- **WHEN** staff drag a job someone else has changed since the diary loaded
- **THEN** the move is refused and the diary reloads

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
- **WHEN** staff add Sam's lunch, Monday to Friday 13:00–13:30, reason "Lunch"
- **THEN** it is saved and listed

#### Scenario: A closure with times
- **WHEN** staff add a shop closure from 09:00 to 12:00
- **THEN** it is refused with "A shop closure covers whole days - leave the times out"

#### Scenario: A weekly block with no mechanic
- **WHEN** staff add a weekly block with no mechanic
- **THEN** it is refused with "A weekly block needs a mechanic"

#### Scenario: Changing the end time
- **WHEN** staff change only the lunch's end time to 14:00
- **THEN** the reason "Lunch" is kept

#### Scenario: Listing a date range
- **WHEN** staff list blocks from 2 to 31 January 2030
- **THEN** every weekly block and the date blocks overlapping that range are listed, and a block in March is not

### Requirement: A new block reports the bookings it clashes with and moves none
Adding or changing a block SHALL report the live bookings it overlaps, from the later of the block's first day and the shop's today, and SHALL NOT move or cancel them. A shop closure SHALL clash with every job on its days; a mechanic's whole-day block only with that mechanic's jobs; a timed block only with that mechanic's timed jobs it overlaps. Cancelled bookings SHALL NOT clash.

#### Scenario: Lunch over a job
- **WHEN** staff add a Monday lunch 13:00–13:30 for Sam, who has a job 12:45–13:45 and another 15:00–16:00
- **THEN** the first job is reported as a clash and stays at 12:45, and the second is not reported

#### Scenario: A closure over a walk-in
- **WHEN** staff close the shop on a day with an unassigned 60-minute job
- **THEN** that job is reported as a clash

### Requirement: Staff are held to the shop's rules but never to capacity
A job staff create, edit, move or accept SHALL be checked against the shop's open days, the day's hours, the mechanic's working days, the mechanic's other jobs (see `workshop-jobs`) and another customer's waiting requested time, but SHALL NOT be refused because of a block, the reserve or the mechanic's free minutes. The only capacity refusal staff can meet SHALL be a time held by a leftover hold with no job behind it, refused with "That time is no longer available - please choose another.".

#### Scenario: Booking into lunch
- **WHEN** staff book Sam from 13:00 to 13:30 on a Tuesday when Sam has lunch then
- **THEN** the job is created

#### Scenario: Over another customer's requested time
- **WHEN** staff book Sam from 14:30 to 15:30 on a day another customer has asked to move to 14:00–15:00 with Sam
- **THEN** it is refused with "That mechanic is already booked over part of that window - please choose another time."

#### Scenario: Past a full day
- **WHEN** Alex is booked 09:00 to 18:00 and staff add a 240-minute job for Alex that day with no time
- **THEN** the job is created

### Requirement: Each mechanic's free time is worked out one way for everyone
A mechanic SHALL have time only on a weekday the shop opens and they work, with no shop closure. From the day's hours SHALL come off: their blocks; their timed jobs, overlaps counted once; their untimed jobs' minutes; an equal share of the shared queue (jobs with no mechanic) among the mechanics with any time that day; and the reserve. Ended bookings SHALL take no time; a customer's requested time SHALL take time until answered.

#### Scenario: Lunch and a job
- **WHEN** Sam works 09:00–18:00 on a Monday with lunch 13:00–13:30 and a job 12:45–13:15
- **THEN** Sam's first free window is 09:00–12:45 and Sam has 495 free minutes

#### Scenario: The shared queue
- **WHEN** two mechanics each have a 540-minute drop-off day and 1000 minutes of unassigned work are queued
- **THEN** each carries 500 of them

#### Scenario: Assigning a queued walk-in
- **WHEN** a 120-minute walk-in in the shared queue is given to Sam
- **THEN** the queue drops to 0 and Sam's free minutes drop by the 60 the other mechanic had been carrying

#### Scenario: Leave
- **WHEN** one mechanic is on leave for the day
- **THEN** that mechanic takes no share of the shared queue

### Requirement: Staff can see the capacity of a range of days
The server SHALL give signed-in staff, for up to 62 days (no screen shows it yet), each day's booking mode, whether the shop is closed and why, the shared queue's minutes, the clashes between blocks and jobs (never a job's requested time), and for each mechanic whether they work, their free minutes, free windows and blocks with reasons. Without a sign-in it SHALL be refused, as SHALL bad dates, an end before the start, or more than 62 days ("Ask for at most 62 days at a time").

#### Scenario: A shop closure
- **WHEN** the shop is closed on 8 September 2026 for "Training"
- **THEN** that day reads closed, with the reason "Training", and every mechanic has 0 free minutes

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
- **WHEN** Sam's 10:00 booking is cancelled
- **THEN** 10:00 is offered again

### Requirement: Customers are told nothing about why time is taken
What customers are offered SHALL NOT include a block's reason, other customers' jobs or minute totals. The older booking page SHALL see blocks, closures and shorter days only as busy time with a mechanic, a date and a window, and a mechanic-day with nothing left as full. More than 62 days, a job length outside 1 to 720 minutes, a date that does not exist, an end before the start, or a mechanic that is not a number SHALL be refused.

#### Scenario: Lunch with the dentist
- **WHEN** Sam has lunch on Mondays 13:00–13:30, reason "Lunch with the dentist", and a customer asks for a 60-minute job on a Monday
- **THEN** Sam is offered 12:00 but not 12:30 or 13:00, Alex is offered 13:00, 13:00–13:30 shows as busy, and the reason appears nowhere

#### Scenario: A closure
- **WHEN** the shop is closed for "Staff training"
- **THEN** no start is offered that day, every mechanic's day is full, and the reason appears nowhere

### Requirement: Customers are held to capacity when they book or change
A customer's booking or change SHALL be refused when the time is in a block or outside the mechanic's time, when it would leave the mechanic's day short of the reserve, when it overlaps another booking or a customer's requested time, or when another booking already holds that start. In drop-off mode a chosen time SHALL be refused. A refused booking SHALL leave nothing behind.

#### Scenario: A block
- **WHEN** a customer asks to move to 14:00 with Sam, who has a block from 13:00 to 15:00
- **THEN** it is refused with "That mechanic is unavailable at that time - please choose another time or day."

#### Scenario: The reserve
- **WHEN** the mechanic has 180 minutes free with a 120-minute reserve
- **THEN** a 30-minute job is accepted and a 120-minute service is refused with "That mechanic does not have enough free time that day - please choose another day, or a shorter job."

#### Scenario: A requested time
- **WHEN** a customer asks for 14:30 with Sam while another customer's request for 14:00–15:00 waits
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
- **WHEN** a customer has asked to move to 14:00–15:00 with Sam
- **THEN** the calendar does not offer Sam 13:30, 14:00 or 14:30 for a 60-minute job

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
A shop SHALL be able to schedule a change to the other booking mode from a date, and cancel it by sending neither part. The change SHALL need both parts, a real date from tomorrow on in the shop's time zone, and a different mode. Other saves SHALL keep it. Once its date arrives the new mode SHALL count from that date on, even before a save writes it in. Setting the mode directly to the scheduled one SHALL clear the schedule.

#### Scenario: Drop-off from a later date
- **WHEN** a timed shop schedules drop-off from a future date
- **THEN** it stays timed until then, and days from that date on are drop-off

#### Scenario: Today, half a change, or the same mode
- **WHEN** staff schedule a change dated today, send only the mode, or schedule the mode the shop already uses
- **THEN** each is refused, with "A mode change must start tomorrow or later", "Give both the new mode and the date it starts, or neither to cancel" or "The shop already uses that mode"

#### Scenario: Another time zone
- **WHEN** it is 07:00 on 1 September in the UK and 23:00 on 31 August in Los Angeles
- **THEN** a UK shop cannot schedule a change from 1 September, and a Los Angeles shop can

### Requirement: Minimum notice and the time zone have limits
Minimum notice SHALL be 0 minutes to 7 days in whole minutes, a number sent as text accepted, and refused otherwise (including an empty value) with "Minimum notice must be between 0 minutes and 7 days"; leaving the field out SHALL keep the old value. The time zone SHALL be one the server recognises, refused otherwise with "That time zone isn't recognised".

#### Scenario: A week's notice in New York
- **WHEN** staff save 10080 minutes of notice and the New York time zone
- **THEN** both are saved, and kept by later saves that leave them out

#### Scenario: Notice out of range
- **WHEN** staff send -1, 10081, 1.5, "abc" or an empty value
- **THEN** each is refused with "Minimum notice must be between 0 minutes and 7 days"

### Requirement: Prices online and the shop's own booking terms are settings
Whether prices show online SHALL save as on or off. The shop's own booking terms SHALL be saved trimmed, kept when a save leaves them out, and reverted to the standard Wheelhouse terms by an empty value or a blank text; terms over 20,000 characters SHALL be refused with "Booking terms can be up to 20,000 characters", and anything not text with "Booking terms must be text".

#### Scenario: Blank terms
- **WHEN** staff save terms of only spaces
- **THEN** the shop has no terms of its own again
