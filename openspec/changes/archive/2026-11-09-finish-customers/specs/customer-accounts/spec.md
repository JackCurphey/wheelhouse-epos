# Spec Delta

Lines marked **[Q n]** follow a small default in `design.md` § Open questions, question n, for Jack to overrule.

## ADDED Requirements

### Requirement: The account shows the customer's store credit
When the shop has Store credit switched on, a signed-in customer's account SHALL show a "Store credit" card with their balance, "£[credit]", and "Use it in the shop or online" (`ac-account`; account and reminders decision 1). With Store credit off, or at a Lightspeed shop, there SHALL be no card.

#### Scenario: Maya's store credit
- **WHEN** Maya Patel, signed in, holds store credit at a shop with Store credit on
- **THEN** her account shows "Store credit" with the amount and "Use it in the shop or online"

#### Scenario: Store credit off
- **WHEN** the shop has Store credit switched off
- **THEN** her account has no Store credit card, whatever she holds

### Requirement: The account's bikes show their warranty
A bike bought at the shop SHALL show "Bought here" and each of its warranty lines with its own end, as the customer page does, on the customer's account, or that its warranty has ended; a bike from elsewhere SHALL show neither (`ac-account`; Jack, 9 Nov, answer 3).

#### Scenario: Maya's Trek on her account
- **WHEN** Maya's Trek Domane AL 3 was bought here and Trek's lines are Frame lifetime and Components 2 years
- **THEN** her account shows "Bought here · under warranty" with "Frame: lifetime · Components: until [date], [n] months left" under it

### Requirement: Asking to delete warns that store credit will be lost
When a customer holding store credit asks to delete their account, the pop-up SHALL say "You have £[credit] of store credit. It will be lost when your account is deleted — use it first, or ask for it back." (`ac-delete`, audit M12), and SHALL still let them ask.

#### Scenario: Maya holds credit
- **WHEN** Maya holds store credit and presses "Ask us to delete your account"
- **THEN** the pop-up shows that line with her amount, and "Ask to delete" still sends the request

### Requirement: Money owed on account delays a deletion the customer asks for
When a customer who owes on account asks to delete their account, the pop-up SHALL say the deletion waits until what they owe is paid, and SHALL still let them ask, as a bike in the workshop does. [Q 16]

#### Scenario: Maya owes on account
- **WHEN** Maya owes on account and asks to delete her account
- **THEN** the pop-up says it waits until what she owes is paid, and she can still ask
