## ADDED Requirements

### Requirement: An unfinished booking comes back on a later visit

A booking in progress SHALL be kept on the customer's device for 7 days,
besides the tab's own copy. Coming back to the shop's booking page later,
with no copy in the tab, SHALL bring it back on the step the customer left,
with "You didn't finish booking. Carry on where you left off — everything
you typed is still here.", Carry on and Start again. Start again SHALL clear
it and go to the first step. Sending the booking SHALL clear it. A refresh
in the same tab SHALL show no banner.

#### Scenario: Coming back the next day
- **WHEN** Maya chose a Standard service, told us about her bike, closed the tab, and opens the booking page the next day
- **THEN** she's on the step she left, with everything filled in, and the banner

#### Scenario: Start again
- **WHEN** she presses Start again
- **THEN** the booking starts empty on the first step, and nothing is kept

#### Scenario: Too old
- **WHEN** she comes back after more than 7 days
- **THEN** the booking starts empty and the old copy is gone
