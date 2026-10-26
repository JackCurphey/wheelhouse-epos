## MODIFIED Requirements

### Requirement: The account page
A signed-in customer SHALL have an account page at their shop, "Your account", showing their name and email with Sign out, "Ask the shop a question" and "Book a repair", their bikes with any repair in now, their details and how the shop contacts them, and their history. "Ask the shop a question" SHALL open their conversation with the shop. Signed out, the page SHALL send the customer to sign in and back.

#### Scenario: Maya's account
- **WHEN** Maya, signed in, opens her account with her Trek in the shop
- **THEN** she sees "Your account" and her Trek with "In the shop now · WH-1042"

#### Scenario: someone new
- **WHEN** a customer with no bikes and no history opens their account
- **THEN** they see "No bikes yet. Add one to book it in faster." and "Nothing here yet. Your repairs and purchases with North Street Cycles show here."

#### Scenario: signed out
- **WHEN** someone not signed in opens the account
- **THEN** they are taken to sign in, and back to the account after

#### Scenario: asking the shop
- **WHEN** Maya chooses "Ask the shop a question"
- **THEN** her conversation, "Messages with North Street Cycles", opens

### Requirement: The account's history
The account's history SHALL list the customer's repairs and purchases, filtered by Everything, Repairs or Purchases, with what's open now first and the rest newest first, eight at a time. A repair SHALL open its own page. Under Everything, the history SHALL have one row "Messages with [shop]" when the customer has any message, saying "[date] · [shop] replied" (Replied, under Earlier) or "[date] · waiting for a reply" (Sent, under Now), opening the conversation (`ac-account-asked`).

#### Scenario: a repair in the shop
- **WHEN** Maya's repair is in the shop
- **THEN** it is under Now, and choosing it opens its page

#### Scenario: the shop has replied
- **WHEN** Jo has answered Maya's newest message
- **THEN** her history has "Messages with North Street Cycles", "North Street Cycles replied" and Replied, under Earlier

## ADDED Requirements

### Requirement: The conversation page
A signed-in customer SHALL have a page "Messages with [shop]" at `/book/[shop]/messages`, with "Your account" back, their conversation oldest first (their own on the right, the shop's on the left), each repair note marked "About WH-[n]" and opening that repair, and a box with Send and "We'll let you know when [shop] replies." The box SHALL read "Ask the shop a question" while there are no messages and "Your message" after. After sending, the page SHALL say "Sent. We'll let you know when [shop] replies." Signed out, it SHALL go to sign in and back (`ac-ask`, `ac-account-question-sent`, `ac-question`; day answers 2 and 8.1).

#### Scenario: Maya asks a question
- **WHEN** Maya writes in "Ask the shop a question" and sends it
- **THEN** her message joins the thread on the right, and "Sent. We'll let you know when North Street Cycles replies." is announced

#### Scenario: a note on a repair
- **WHEN** Maya's conversation has her note on WH-1042
- **THEN** it is marked "About WH-1042 ›", which opens that repair

#### Scenario: too many at once
- **WHEN** the shop refuses a message because too many were sent at once
- **THEN** the page shows the shop's words: "That’s a lot of messages at once. Try again in a few minutes."
