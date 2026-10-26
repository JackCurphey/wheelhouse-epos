## MODIFIED Requirements

### Requirement: Staff answer customers' notes from one inbox
Staff SHALL see one conversation per customer, holding the customer's general messages, their notes on each repair (each marked with its repair) and the shop's replies, newest conversation first and marked "Needs a reply" while the customer's message is the newest (decisions 3 and 7; day answers 2.3 and 8.2). A staff reply about a repair SHALL be saved on the repair and the customer told with "Reply from the shop"; a reply to a general message SHALL be saved in the conversation and the customer told with "Reply to a message"; each the way the customer chose.

#### Scenario: Replying
- **WHEN** Jo replies "Yes, we'll check it" to Maya's note on WH-1042
- **THEN** the conversation no longer needs a reply, and Maya is sent "North Street Cycles replied about your Trek Domane AL 3 (WH-1042): Yes, we'll check it. Replies to this number aren’t read — reply on your page: [link]"

#### Scenario: One row for Maya
- **WHEN** Maya has written a note on WH-1042 and asked the shop a question from her account
- **THEN** the inbox has one conversation for Maya Patel, with both in it

## ADDED Requirements

### Requirement: The customer is told when the shop replies to their message
When staff reply to a customer's general message, the customer SHALL be sent "Reply to a message", reading "[Shop name] replied to your message: [Link to your messages]", the way they chose; the link opens their conversation, after signing in. The shop SHALL be able to reword or switch it off in Settings › Messages (day answers 2.4).

#### Scenario: Jo answers Maya's question
- **WHEN** Jo replies to Maya's question from her account
- **THEN** Maya is sent "North Street Cycles replied to your message: [link]"

#### Scenario: switched off
- **WHEN** the shop has switched Reply to a message off and Jo replies
- **THEN** the reply is saved, and Jo is told no message went because it is switched off
