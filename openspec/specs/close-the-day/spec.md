# close-the-day Specification

## Purpose
TBD - created by archiving change close-the-day. Update Purpose after archive.

## Requirements

### Requirement: Close the day appears on the till after closing time
For the Owner, the till SHALL show "Close the day" from an hour before today's closing time (cash-up decision 5; `set-eod-close`'s drawn "1 hour before"; `eod-entry`), all day when the opening hours say the shop is shut today, and not once the day is closed. Nobody else SHALL see it until roles.

#### Scenario: An hour before closing
- **WHEN** the shop closes at 17:30 and Jack Lewis, the Owner, is on the till at 16:45
- **THEN** the till shows "Close the day"

#### Scenario: During the day
- **WHEN** it is 11:00 on the same day
- **THEN** the till doesn't show it

### Requirement: The cash is counted blind
"Count the cash" SHALL open with the note-and-coin counter and "Done counting — show the difference", and SHALL not show what the till expects until the count is done (cash-up decisions 2 and 3; `eod-count`).

#### Scenario: Counting
- **WHEN** Jack Lewis opens Close the day
- **THEN** he sees a box for each note and coin and the total, and no expected figure

### Requirement: The difference, and how the till worked it out
Once counted, the step SHALL show Counted, "The till expected", "How the till worked it out" (this morning's float with how it was checked, by whom and when; plus cash sales; minus cash taken out), and the Difference with an optional reason; a count that matches SHALL show "Spot on" and £0.00 with no reason box. "Count again" and "Keep this count and go on" SHALL follow (decision 6; walk-through 2 M2; `eod-count-result`, `eod-count-exact`).

#### Scenario: A difference
- **WHEN** the count is less than the till expected
- **THEN** the step shows how much short, with "If there's a difference, why? (optional)"

#### Scenario: Spot on
- **WHEN** the count matches
- **THEN** the step shows "Spot on" £0.00 and no reason box

### Requirement: What the drawer should hold
The till's expected cash SHALL be this morning's float (what was counted, or the shop's float when it looked right), plus the cash sales since the float check from both sales records, minus the cash taken out since it, minus the cash banked since it for an earlier day nobody closed, in whole pence. Cash from before the check SHALL not be added again: it was in the morning count (Jack's answer 9, 27 Oct).

#### Scenario: A day's cash
- **WHEN** the float looked right at £150.00, cash sales came to £74.00 and £5.00 was taken out
- **THEN** the till expects £219.00

#### Scenario: Cash already counted this morning
- **WHEN** a £22.00 cash sale was made after yesterday's close, and this morning's float was counted at £172.00
- **THEN** the till expects £172.00 plus today's cash, not £194.00

#### Scenario: Yesterday's cash banked this afternoon
- **WHEN** this morning's count was the float plus Wednesday's cash, and Wednesday's cash was banked at its close this afternoon
- **THEN** tonight the till expects the float plus today's cash

### Requirement: Cash taken out
"Add a paid-out" SHALL open "Cash taken out" with the amount, what it was for and an optional note; it SHALL be recorded with who took it out and when, listed under "Cash taken out today", and come off what the till expects. A day with none SHALL say "No cash taken out today." Once the day is closed, no more SHALL be added (`eod-paidout`, `eod-banking`, `eod-banking-none`).

#### Scenario: Paying the window cleaner
- **WHEN** Jack Lewis takes out an amount for what it was for
- **THEN** it is listed with the time and his name, and the till expects that much less

### Requirement: Leave the float, bank the rest
Banking SHALL say "Leave in the drawer" the shop's float and "Bank" the count less the float (cash-up decision 4). When the count is less than the float, nothing SHALL be banked, and the page SHALL say "Put £[n] in to make the float up to £[float]" before finishing (Jack's answer 5, 27 Oct).

#### Scenario: Banking
- **WHEN** the float is £150.00 and £219.00 was counted
- **THEN** it says leave £150.00 and bank £69.00

#### Scenario: A drawer below the float
- **WHEN** the float is £150.00 and £140.00 was counted
- **THEN** it says bank £0.00 and "Put £10.00 in to make the float up to £150.00"

### Requirement: A day runs from the previous close
The report's figures SHALL cover every sale no close has counted yet, each sale counted by exactly one close, so a sale made after a close counts in the next day's takings, and a closed day's report SHALL never change (Jack's answer 6, 27 Oct). A sale SHALL be counted by the close that finds it saved, never placed by its time: a sale still being saved at the close SHALL count in the next close, and a till's own clock SHALL not count a sale twice or lose it.

#### Scenario: A sale after yesterday's close
- **WHEN** yesterday was closed at 18:00 and a cash sale was made at 18:30
- **THEN** it is in today's takings, not yesterday's

#### Scenario: A till with its clock wrong
- **WHEN** a till's clock runs a day fast or slow
- **THEN** each of its sales is counted by one close, once

### Requirement: The figures are checked again before closing
The page SHALL reload the till's figures when the count is done, and the close SHALL be refused with the new figures if a sale or cash taken out changed what the till expects since they were shown, so the owner sees the new difference before the day closes.

#### Scenario: A sale while counting
- **WHEN** a sale is taken at the till while Jack Lewis is counting
- **THEN** Close the day shows the new difference before it closes

### Requirement: One close a day, with its report
"Close the day and show the report" SHALL save the day's close once per shop per day, with who and when, and show "Day closed" with the date and who closed it, and Takings, Card, Cash, "Gift cards, store credit, customer accounts, other", "Float at the start", "Cash difference" and "Banked", and the online money line, with Print (`eod-finish`, `eod-z`). Two closes at once SHALL keep one. The figures SHALL stay as they were at the close.

#### Scenario: Closing
- **WHEN** Jack Lewis closes the day
- **THEN** the report shows the day's takings by how they were paid, the float, the difference and what was banked

#### Scenario: Closing twice
- **WHEN** two people close the day at the same moment
- **THEN** one close is kept and the other is shown it

### Requirement: No close without a float check
The day SHALL not close until the float was checked that morning; the Close the day page SHALL ask for it first with "Looks right" only (the shop's set float, one press), never Count it (Jack's answer 8, 27 Oct).

#### Scenario: Nobody checked the float
- **WHEN** nobody checked the float today and Jack Lewis opens Close the day
- **THEN** the float check pop-up shows first, with Looks right and no Count it

### Requirement: Takings is till money only
The report's Takings SHALL be till money only and SHALL equal Card + Cash + Other. Shopify orders and deposits paid online SHALL be on the online money line instead (Jack's answer 7, 27 Oct). There SHALL be no card machine check until a real card machine is connected (Jack's answer 4).

#### Scenario: A deposit paid online
- **WHEN** a repair was paid partly by a deposit paid online and partly by card at the till
- **THEN** Takings and Card show the card part, and the deposit is on the online money line

### Requirement: Close it closes the earlier day at banking
Close it SHALL open Close the day for the earlier day, with Count the cash done ("Counted this morning by Jo Taylor") and banking open: "Bank Wednesday's cash" (the count less the float) and "Leave in the drawer: The float and today's sales" (`op-close-yesterday`). Below the float it SHALL bank nothing and say how much to put in (Jack's answer 5). Closing it SHALL save that day's own report.

#### Scenario: Banking Wednesday's cash
- **WHEN** the float is £150.00 and Jo Taylor counted £219.00 on Thursday morning
- **THEN** Wednesday's close says bank £69.00, and leave the float and today's sales

### Requirement: The earlier day's report counts its own sales
The earlier day's close SHALL count every sale no close has counted that was made up to the morning count, and its expected cash SHALL be what it started with, plus its cash sales since, less its cash taken out (Jack's 27 Oct answer 6 and 29 Oct answer 5). Every sale SHALL be counted by exactly one close.

#### Scenario: Wednesday and Thursday
- **WHEN** Wednesday is closed on Thursday afternoon, after Thursday's sales
- **THEN** Wednesday's report has Wednesday's sales and Thursday's tonight has Thursday's

### Requirement: Today's close waits for an earlier day
Today's close, and an earlier day's, SHALL be refused while an older day nobody closed has a count waiting; Close the day SHALL open the waiting day first.

#### Scenario: Closing Thursday with Wednesday still open
- **WHEN** Jack Lewis opens Close the day on Thursday night and Wednesday wasn't closed
- **THEN** Wednesday's close shows first
