# Spec Delta

## ADDED Requirements

### Requirement: A service reminder is set up when a bike is collected
When a bike is collected, if its customer said yes to service reminders and one of the job's services has reminder months, Wheelhouse SHALL set up one Service reminder: at the soonest service's months after collection, naming that service, sent at the shop's opening time on that day or its next open day. Setting one up SHALL drop any reminder still waiting for the same bike.

#### Scenario: A Standard service
- **WHEN** Maya, who said yes, collects her bike after a Standard service that reminds after [n] months
- **THEN** a Service reminder waits until the shop opens [n] months after collection, naming Standard service

#### Scenario: No yes
- **WHEN** a customer who didn't say yes collects their bike
- **THEN** no reminder is set up

#### Scenario: The bike comes back
- **WHEN** the same bike is collected again before its reminder goes
- **THEN** the earlier reminder is dropped and a new one set from this visit

### Requirement: A service reminder is checked and written when it goes
When a Service reminder is due it SHALL go only if the customer still says yes, the message is on, the bike hasn't been collected again since, and the bike has no booking waiting. Its words SHALL be the shop's wording, the customer's name and their chosen way of contact as they are when it goes, ending "Stop these: [link]".

#### Scenario: A booking already made
- **WHEN** the reminder comes due while Maya has booked the bike in again
- **THEN** it isn't sent

#### Scenario: New wording
- **WHEN** the shop changes the wording after the reminder was set up
- **THEN** the reminder goes with the new wording
