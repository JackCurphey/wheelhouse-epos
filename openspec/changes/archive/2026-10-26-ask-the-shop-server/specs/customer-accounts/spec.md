## ADDED Requirements

### Requirement: A signed-in customer has one conversation with the shop
A signed-in customer SHALL have one running conversation with the shop, "Messages with [shop]", holding their messages, their notes on each of their repairs (each marked "About [job number]" and opening that repair) and the shop's replies, oldest first. They SHALL be able to send a message of up to 1,000 letters. Only the signed-in customer SHALL read or write their conversation, at their own shop, and a message sent from another website SHALL be refused (day answers 2.1, 2.3, 2.5 and 8.1).

#### Scenario: Maya asks a question
- **WHEN** Maya, signed in at North Street Cycles, sends a message from "Ask the shop a question"
- **THEN** it joins her conversation after her note about WH-1042, and the shop sees it needs a reply

#### Scenario: someone else
- **WHEN** another customer, or a session from another shop, asks for Maya's conversation
- **THEN** they get only their own, or are told they aren't signed in

#### Scenario: from another website
- **WHEN** a message is sent to Maya's conversation from another website
- **THEN** it is refused and nothing is added

### Requirement: The account's history has one row for the conversation
The account's history SHALL have one "Messages with [shop]" item when the customer has any message or note, dated by the newest message and saying whether the shop has replied (`ac-account-asked`).

#### Scenario: the shop has replied
- **WHEN** Jo has answered Maya's newest message
- **THEN** her history has one messages item saying the shop replied

### Requirement: A customer stays signed in for 30 days from their last visit
A customer's sign-in SHALL last 30 days from the last time they used it on that phone or computer, not 30 days from signing in (day answers 2.2). Renewing SHALL not write on every request: a session is renewed when used with less than 29 days left. A sign-in unused for 30 days SHALL end.

#### Scenario: a regular customer
- **WHEN** Maya signed in 10 days ago and opens her account
- **THEN** she stays signed in for 30 days from today

#### Scenario: away too long
- **WHEN** Maya hasn't used her sign-in for more than 30 days
- **THEN** she is asked to sign in again
