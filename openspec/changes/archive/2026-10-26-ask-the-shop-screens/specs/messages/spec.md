## MODIFIED Requirements

### Requirement: Staff read and answer customers' notes in the Messages inbox
Front desk › Messages SHALL list one conversation per customer, "Needs a reply" first with its count, and open one beside the list (on a phone, on its own with a way back) with the customer, their phone, the thread with each repair note marked with its repair, and a reply box; the address SHALL say which customer is open. A reply SHALL be about the repair of the customer's newest message, or general when that message was general, and the box SHALL say which. Sending SHALL say how the reply went (decision 7; day answers 8.2; ac-inbox).

#### Scenario: Answering Maya
- **WHEN** Jo opens Messages, chooses Maya Patel's conversation, whose newest message is her note on WH-1042, and sends "Yes, we’ll check it"
- **THEN** the reply joins the thread as a note on WH-1042, the page says "Sent to Maya by text, with a link to reply on the job’s page.", and Maya's conversation leaves Needs a reply

#### Scenario: Answering a general message
- **WHEN** a customer's newest message came from their account and Jo replies
- **THEN** the page says the reply went with a link to their messages

#### Scenario: One row for Maya
- **WHEN** Maya has a note on WH-1042 and a message from her account
- **THEN** the inbox has one row for Maya Patel, and her conversation shows both, the note marked "About WH-1042"
