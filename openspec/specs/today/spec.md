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

Someone who isn't the Owner SHALL see Workshop today but not Needs attention, and the server SHALL refuse them the list behind it, until roles let Managers and those who can close the day see it too.

#### Scenario: Jo Taylor opens Today

- **WHEN** Jo Taylor, who isn't the Owner, opens Today
- **THEN** she sees Workshop today and no Needs attention card
