## ADDED Requirements

### Requirement: The morning after a day nobody closed, the count is that day's count
When the last day the till opened wasn't closed, and the shop has closed a day before it, the first person in SHALL see what that day started with "plus Wednesday's cash", and Count it only (`op-float-check-unclosed`; walk-through 2 H1(b) and decision 6; Jack's 29 Oct answer 5). The count SHALL be kept as that day's count, its difference against the full figure.

#### Scenario: Wednesday wasn't closed
- **WHEN** Wednesday 16 September started with the float, took cash, and nobody closed it, and Jo Taylor is first in on Thursday
- **THEN** she sees the float plus Wednesday's cash, and only Count it

#### Scenario: The count becomes Wednesday's
- **WHEN** Jo Taylor counts the drawer
- **THEN** her count is kept as Wednesday's count, and a difference is against the float plus Wednesday's cash

### Requirement: At closing, a float nobody checked is still only looked at
When the Owner closes a day whose float nobody checked, the look at closing SHALL stay a look even after a day nobody closed (Jack's answer 8, 27 Oct); no count then waits for the earlier day, and the day's close counts its sales as before.

#### Scenario: Nobody was in on Thursday morning
- **WHEN** nobody checked the float on Thursday and Jack Lewis closes the day
- **THEN** he is asked Looks right only, and Thursday's close counts Wednesday's sales with Thursday's
