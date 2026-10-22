# messages Specification

## Purpose
The texts and emails a shop's customers get: Wheelhouse's wording or the shop's own, queued the customer's way with a minute to Undo where staff trigger them, and an outbox staff see on each job. Pretend for now: nothing reaches a real phone or inbox until Jack switches real sending on (Jack, 20 Oct).

## Requirements

### Requirement: Messages are pretend until Jack says otherwise
Every automatic message SHALL be recorded in the outbox as pretend and SHALL NOT be sent to a real phone or email address until Jack switches real sending on for that channel (Jack, 20 Oct).

#### Scenario: Bike ready
- **WHEN** a job is marked finished
- **THEN** "Bike ready" is filled in for the customer and recorded in the outbox as pretend, after a minute's Undo, and nothing is sent

### Requirement: A shop can reword or switch off its messages
Each automatic message SHALL have Wheelhouse's wording, which the shop can reword with tap-ins, switch off, or go back to (owner setup 14).

#### Scenario: Switched off
- **WHEN** the shop switches Bike ready off
- **THEN** finishing a job queues no Bike ready message

#### Scenario: Only the Owner changes a message
- **WHEN** a staff member who isn't the Owner changes a message
- **THEN** it is refused, as other Settings are until roles are built

#### Scenario: Going back to Wheelhouse's wording
- **WHEN** the Owner clears a message's wording, or chooses Go back to Wheelhouse's wording
- **THEN** the message reads Wheelhouse's wording again

#### Scenario: Preview
- **WHEN** someone previews a message, as saved or as they type it
- **THEN** they see it filled in with the drawings' example (Maya, Trek Domane AL 3, WH-1042) and the shop's own name, as a text and as an email with its subject

### Requirement: Staff can undo a message for a minute
Quote to approve and Bike ready SHALL wait a minute before they go, and Undo in that minute SHALL stop them (drop-off and quote decision 5; UX walk-through H2). The booking answers (Booking confirmed, New time offered, Request declined, Date change answered, Booking cancelled) SHALL go at once, with no Undo: undoing the message wouldn't undo the answer (Jack, 22 Oct).

#### Scenario: Undo
- **WHEN** staff send a quote and press Undo within the minute
- **THEN** Quote to approve isn't sent

#### Scenario: A booking answer
- **WHEN** staff accept a booking request
- **THEN** Booking confirmed is queued to go at once, with no Undo

### Requirement: Staff see a job's messages as a conversation
The job page's "Message [customer]" button SHALL open "Messages": the job's messages oldest first, the shop's on the right with each message's name, state, how and when, the customer's on the left, and a line saying messages are pretend (Jack, 20 Oct, `docs/decisions/2026-10-20-messages-engine.md` answer 2; drawn as job-messages).

#### Scenario: Bike ready waiting
- **WHEN** staff mark a job ready and open its Messages
- **THEN** Bike ready shows on the right as Waiting, by the customer's way, with the time it goes and the words the customer gets

#### Scenario: No messages
- **WHEN** a job has sent nothing
- **THEN** Messages says "No messages yet."

### Requirement: Staff answers send the booking messages
Accepting a booking request, offering another time, declining, and accepting a date change SHALL each queue its booking message (Booking confirmed, New time offered, Request declined, Date change answered) for the customer at once, by their chosen way, unless it is switched off (Jack, 20 Oct, booking messages answer 4).

#### Scenario: Accepting a request
- **WHEN** staff accept a booking request
- **THEN** Booking confirmed is queued with the booked day and time, when to drop off and the shop's note

#### Scenario: Declining with a message
- **WHEN** staff decline with a message
- **THEN** Request declined is queued with the message in it

### Requirement: A pretend message leaves the customer's link working
While sending is pretend, a message SHALL show "[link]" in place of a link and SHALL NOT issue a new booking link, so the link the customer already has keeps working.

#### Scenario: Bike ready while pretend
- **WHEN** a job is marked ready while sending is pretend
- **THEN** Bike ready reads "See what we did: [link]." and the customer's existing link still opens their page

### Requirement: Staff are told when a booking message couldn't reach the customer
When a staff answer's booking message has no way to reach the customer (no phone or email), the diary SHALL say so with the message's name, until closed; a message switched off in Settings SHALL say nothing (drawn as diary-no-message).

#### Scenario: No phone or email
- **WHEN** staff accept a request from a customer with no phone or email
- **THEN** the diary shows "“Booking confirmed” didn’t go: [customer] has no phone number or email on file." with Close

### Requirement: The customer's side sends Request received and Booking cancelled
A booking request that waits for the shop SHALL send Request received. Cancelling a booking, from the customer's page or by the shop, SHALL send Booking cancelled. Each SHALL go the customer's way at once, carry the link the customer already has, and be left out when switched off in Settings › Messages.

#### Scenario: A request sent
- **WHEN** Maya sends a booking request the shop answers itself
- **THEN** she gets Request received, and her booking link keeps working

#### Scenario: Cancelled from the booking page
- **WHEN** Maya cancels her booking from its page
- **THEN** she gets Booking cancelled: "There's nothing to pay or refund. Book another time: [link]."

### Requirement: The customer is told about work added within their limit
The "Work added within your limit" message SHALL go to the customer when work is agreed within their spending limit, saying what was added, its cost and their limit, with their link and the shop's phone.

#### Scenario: Pads and fitting
- **WHEN** pads and fitting for £46 are agreed within Maya's £200 limit
- **THEN** Maya's message says "Added: Shimano brake pads, Fit and adjust brakes, £46.00" and mentions the £200 limit
