## ADDED Requirements

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

## MODIFIED Requirements

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
