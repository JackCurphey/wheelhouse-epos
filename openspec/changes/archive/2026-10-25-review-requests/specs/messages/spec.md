# Spec Delta

## ADDED Requirements

### Requirement: A review request goes after collection, when the shop has switched it on
A Review request SHALL be off until the shop switches it on, which SHALL need its review page first ("Add your review page first, then switch this on."). When it is on and a bike is collected, a customer who said yes to review requests SHALL get one, at the shop's opening time on the day the shop's days after collection come round, reading "Thanks for coming to [Shop name], [Customer’s first name]. If you have a minute, we’d love a review: [Link to review]." and ending "Stop these: [link]".

#### Scenario: Switched on
- **WHEN** the shop has its Google page as its review page, sends after [n] days, and Maya, who said yes, collects her bike
- **THEN** a review request waits until the shop opens [n] days later

#### Scenario: Off
- **WHEN** the shop hasn't switched review requests on
- **THEN** nothing is set up when Maya collects her bike

### Requirement: A customer stops review requests with a press
A review request's "Stop these" link SHALL open the stop page for review requests: "Stop review requests?", then "Review requests stopped" with "Turn them back on", then "Review requests are on again". Stopping SHALL turn off review requests only.

#### Scenario: Stopping reviews only
- **WHEN** Maya stops review requests
- **THEN** her service reminders still come
