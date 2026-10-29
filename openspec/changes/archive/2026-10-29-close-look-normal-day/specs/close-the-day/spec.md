## MODIFIED Requirements

### Requirement: What the drawer should hold
The till's expected cash SHALL be this morning's float (what was counted, or the shop's float when it looked right), plus the cash sales since the float check from both sales records, minus the cash taken out since it, minus the cash banked since it for an earlier day nobody closed, in whole pence. Cash from before the check SHALL not be added again: it was in the morning count (Jack's answer 9, 27 Oct). When the day's only check is the Owner's look at closing, the figure SHALL start from the last close instead, with the float left in (Jack's 29 Oct answer 7).

#### Scenario: A day's cash
- **WHEN** the float looked right at £150.00, cash sales came to £74.00 and £5.00 was taken out
- **THEN** the till expects £219.00

#### Scenario: Cash already counted this morning
- **WHEN** a £22.00 cash sale was made after yesterday's close, and this morning's float was counted at £172.00
- **THEN** the till expects £172.00 plus today's cash, not £194.00

#### Scenario: Yesterday's cash banked this afternoon
- **WHEN** this morning's count was the float plus Wednesday's cash, and Wednesday's cash was banked at its close this afternoon
- **THEN** tonight the till expects the float plus today's cash

#### Scenario: No morning check, a look at closing
- **WHEN** the float is £100.00, nobody checked it this morning, £60.00 was taken in cash before Jack Lewis's look at 17:30, and he counts £160.00
- **THEN** the till expects £160.00, banks £60.00, and the difference is £0.00
