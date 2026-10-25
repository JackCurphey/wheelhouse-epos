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

### Requirement: A quote with no answer gets one reminder
When a quote is sent, the customer SHALL get one "Quote reminder" after the shop's hours (24 to start) if they haven't answered; answering, the shop withdrawing it, or a newer quote SHALL stop it (Jack, 1 Oct and 22 Oct). A quote never expires by itself.

#### Scenario: No answer after 24 hours
- **WHEN** Maya's quote was sent and she hasn't answered 24 hours later
- **THEN** she is sent the Quote reminder, once

#### Scenario: Answered first
- **WHEN** Maya answers before the 24 hours are up
- **THEN** no reminder goes

### Requirement: The customer gets their answers after a call
When staff record a customer's quote answer taken by phone, the customer SHALL be sent "Your answers" at once, saying what is going ahead and its cost, and what they said no thanks to (dq-record-answer; Jack, 22 Oct).

#### Scenario: Pads yes, cable no
- **WHEN** Jo records by phone that Maya said yes to the pads and fitting and no to the cable
- **THEN** Maya is sent "Going ahead: Shimano brake pads and Fit and adjust brakes, £46.00. No thanks: Replace gear cable."

### Requirement: Staff answer customers' notes from one inbox
Staff SHALL see a conversation per job with notes, newest first, marked "Needs a reply" while the customer's note is the newest; a staff reply SHALL be saved on the job and the customer told with "Reply from the shop", the way they chose (decisions 3 and 7).

#### Scenario: Replying
- **WHEN** Jo replies "Yes, we'll check it" to Maya's note
- **THEN** the conversation no longer needs a reply, and Maya is sent "North Street Cycles replied about your Trek Domane AL 3 (WH-1042): Yes, we'll check it. Replies to this number aren’t read — reply on your page: [link]"

### Requirement: Staff read and answer customers' notes in the Messages inbox
Front desk › Messages SHALL list a conversation per job with notes, "Needs a reply" first with its count, and open one beside the list (on a phone, on its own with a way back) with the customer, the job, the thread and a reply box; sending SHALL say how the reply went (decision 7; ac-inbox).

#### Scenario: Answering Maya
- **WHEN** Jo opens Messages, chooses Maya Patel's conversation and sends "Yes, we’ll check it"
- **THEN** the reply joins the thread, the page says "Sent to Maya by text, with a link to reply on the job’s page.", and Maya's conversation leaves Needs a reply

### Requirement: Bike ready waits for Send now when Don't close things by themselves is on

When the person marking a job ready has "Don't close things by themselves" on,
Bike ready SHALL be held, not sent after a minute: it SHALL wait until Send now
sends it or Undo stops it, however long that takes. Send now SHALL send only a
held message.

#### Scenario: Held, then sent
- **WHEN** Jo, with the switch on, marks Maya's job ready and later presses Send now
- **THEN** Bike ready waits with no send time until then, and goes as soon as she presses it

#### Scenario: Held, then undone
- **WHEN** Jo presses Undo instead
- **THEN** Bike ready is never sent

#### Scenario: Switch off
- **WHEN** someone with the switch off marks a job ready
- **THEN** Bike ready goes after its minute, as before

#### Scenario: The bike has gone before Send now
- **WHEN** Maya collects the bike while Bike ready is still waiting
- **THEN** Bike ready is never sent, and Send now says the bike has been collected

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
