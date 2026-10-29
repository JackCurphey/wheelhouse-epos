# today Specification

## Purpose
Office › Today is where the shop's day starts: what needs the Owner's attention, and the workshop's day at a glance.

## Requirements

### Requirement: Today shows the workshop's day

Today SHALL show the date and the shop, and a Workshop today card with the bikes expected today and how many are still to arrive, the repairs ready to collect, a Still to arrive list with each job's reference, customer, bike, work and time or "Drop-off", Book in once a job is due, and Open the diary. The figures SHALL be the Workshop Overview's.

#### Scenario: The Owner opens Today

- **WHEN** the Owner signs in and three of today's eight bikes haven't arrived, and four repairs are ready
- **THEN** Today shows "Expected today 8 bikes", "3 still to arrive", "Repairs ready to collect 4", and lists WH-1045 · Jamie Brooks, Giant Escape 2 · Gear adjustment, 10:30 appointment, among the still to arrive

#### Scenario: Booking a bike in from Today

- **WHEN** WH-1042's appointment is due and the Owner presses its Book in
- **THEN** it is booked in as from the Workshop Overview, and leaves the Still to arrive list

### Requirement: Needs attention lists what's waiting on the Owner

For the Owner, Today SHALL show a Needs attention card whose heading carries its count, listing each quote with no answer after its reminder and, when customers' messages need a reply, how many and the oldest; with nothing to list it SHALL say "Nothing needs you right now".

#### Scenario: A quote with no answer

- **WHEN** WH-1042's quote to Maya Patel was sent and reminded, and she hasn't answered
- **THEN** Needs attention shows "WH-1042 · Maya Patel — no answer to the quote yet", when it was sent and reminded, her phone number as a link, and Record their answer, which opens the job

#### Scenario: Messages need a reply

- **WHEN** two customers' messages are waiting for a reply, the oldest from Maya Patel
- **THEN** Needs attention shows "2 messages need a reply", "From customers · oldest from Maya Patel at [time]", and Open Messages

#### Scenario: Nothing waiting

- **WHEN** no quote is waiting and no message needs a reply
- **THEN** Needs attention says "Nothing needs you right now" with no count

### Requirement: Staff see the workshop's day only

Someone who isn't the Owner SHALL see Who's in and Workshop today but not Needs attention or Tills, and the server SHALL refuse them the lists behind those, until roles let Managers and those who can close the day see them too (opening the shop decision 4; `op-today-staff`).

#### Scenario: Jo Taylor opens Today

- **WHEN** Jo Taylor, who isn't the Owner, opens Today
- **THEN** she sees Who's in and Workshop today, and no Needs attention or Tills card

### Requirement: A short float goes to Needs attention until Seen
A float counted short SHALL be on the Owner's Needs attention, whatever day it was counted, until Seen: "Till [code]’s float was [£] short this morning" when it was counted on a set-up till, "The float was [£] short this morning" otherwise, with "on [date]" in place of "this morning" for an earlier day's, "Counted by [Name] at [time]", with "“[their reason]”" when one was given, and a "Seen" button (opening the shop decisions 4 and 8, audit H3; `op-today-short`).

#### Scenario: Jack sees a short float
- **WHEN** Jo Taylor counted the float short on Till B1 this morning and Jack Lewis, the Owner, opens Today
- **THEN** Needs attention says "Till B1’s float was [£] short this morning", who counted it and when, with Seen

#### Scenario: Nobody saw it yesterday
- **WHEN** yesterday's float was counted short and nobody pressed Seen
- **THEN** today Needs attention still lists it, with yesterday's date

### Requirement: Seen clears a short float, for the Owner
"Seen" SHALL take a short float off Needs attention in one click and record who and when (`op-today-seen`). Only the Owner SHALL see it or press Seen, until roles.

#### Scenario: Seen
- **WHEN** Jack Lewis presses Seen
- **THEN** the line goes and stays gone

### Requirement: An over float goes to Needs attention when yesterday was closed
A float counted over SHALL be on the Owner's Needs attention until Seen, but only when the shop's previous day (the last day the till opened) was closed: "The float was [£] over this morning", or "on [date]" for an earlier day, "Counted by [Name] at [time]", the reason when one was given, and "Seen" (opening the shop decision 8 H1; the short float's line, `op-today-short`). When the previous day wasn't closed, or there is none, it SHALL not be listed.

#### Scenario: Over after a closed day
- **WHEN** yesterday was closed and Jo Taylor counted the float over this morning
- **THEN** Needs attention says the float was over, by how much, with Seen

#### Scenario: Over after a day nobody closed
- **WHEN** yesterday wasn't closed and the float is over this morning
- **THEN** Needs attention doesn't list it

### Requirement: Who's in shows who checked in today, and who's due
Today SHALL show a Who's in card listing everyone who checked in at the till with their PIN today, "Checked in at [time] · [Owner, Mechanic or Staff]" with "In", first in first; then each mechanic due today who hasn't checked in, "Due in at [start time] · Mechanic" with "Not in yet", which SHALL read "Late" once the start time has passed (opening the shop decisions 3, 5 and 6; `op-today`, `op-today-late`). Nothing SHALL go to Needs attention for someone late. Who's in SHALL never carry a PIN.

#### Scenario: Jo has checked in
- **WHEN** Jo Taylor checked in at the till this morning
- **THEN** Who's in lists Jo Taylor, "Checked in at [time] · Staff", "In"

#### Scenario: Alex is due and hasn't come
- **WHEN** Alex Morgan works today from [start time] and hasn't checked in, and that time has passed
- **THEN** Who's in lists Alex Morgan, "Due in at [start time] · Mechanic", "Late"

#### Scenario: A mechanic off today
- **WHEN** a mechanic doesn't work today, or has the day off
- **THEN** Who's in doesn't list them until they check in

### Requirement: Tills shows whether the till is open, for the Owner
For the Owner, Today SHALL show a Tills card with one line per till, headed "Till [code]" (`op-today`), and one headed "Till" for a computer that isn't a set-up till when no till is set up or one was used today: "Open · float checked by [Name] at [time]" on the till the float was checked at, "Open · [Name] checked in at [time]" from that till's first check-in otherwise, or "Not open yet"; with "Float short" while a short float waits to be Seen, and "Float short · seen by [Name]" after (`op-today-short`, `op-today-seen`). The server SHALL refuse it to anyone else, until roles.

#### Scenario: The float was checked
- **WHEN** Jo Taylor checked the float on Till B1 this morning and Jack Lewis opens Today
- **THEN** Tills reads "Till B1" and "Open · float checked by Jo Taylor at [time]"

#### Scenario: Staff
- **WHEN** Jo Taylor opens Today
- **THEN** she sees no Tills card, and the server refuses her its lines

### Requirement: A big stock adjustment goes to Needs attention until Seen
An adjustment worth more, at cost, than the amount set in Settings › Stockroom SHALL be on the Owner's Needs attention until Seen: "Stock adjusted: [Product] [change] · £[value]", with the product's name opening its page, and "[Reason] · by [Name] at [time]" (stock control decision 6; `st-today-adjust`). An adjustment from an earlier day SHALL give its day too. Seen SHALL take the line off in one click and record who and when. Only the Owner SHALL see the line or press Seen, until roles.

#### Scenario: Jo Taylor writes off damaged stock
- **WHEN** the amount set is £[amount] and Jo Taylor adjusts a product down with Damaged, worth more than that at cost
- **THEN** Jack Lewis's Needs attention shows "Stock adjusted: [Product] −[n] · £[value]" and "Damaged · by Jo Taylor at [time]", with Seen

#### Scenario: A small adjustment
- **WHEN** an adjustment is worth the amount set or less, or no amount is set
- **THEN** it is only in the product's stock history

#### Scenario: Seen
- **WHEN** Jack Lewis presses Seen
- **THEN** the line goes and stays gone

### Requirement: Products below zero go to Needs attention, with Count them
When any product is below zero, the Owner's Needs attention SHALL show "[n] products below zero" and "Sold more than Wheelhouse thought were here · Count them starts a count straight away", with See them and Count them (stock control decision 9; `st-today-below`). See them SHALL open Stock with Below zero picked. Count them SHALL start a stock take of just those products and open its counting page; if one is already counting, it SHALL open that one. The line SHALL go when none are below zero. On a phone See them and Count them SHALL sit under the words.

#### Scenario: Two products sold below zero
- **WHEN** two products are below zero and Jack Lewis opens Today
- **THEN** Needs attention shows "2 products below zero" with See them and Count them

#### Scenario: Count them
- **WHEN** Jack Lewis presses Count them
- **THEN** a below-zero count starts and its counting page opens

#### Scenario: Nothing below zero
- **WHEN** no product is below zero
- **THEN** there is no below-zero line
