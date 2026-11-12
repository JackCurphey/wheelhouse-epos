## ADDED Requirements

### Requirement: Six online order messages, each switchable
Settings › Messages SHALL list "Online order messages": Order confirmation ("When an online order is paid"), Order ready to collect ("When an online order is ready"), Order still waiting ("When an order isn’t collected after [n] days"), Item we couldn’t supply ("When staff refund an item, with their reason"), Order cancelled ("When an order is cancelled, by the customer or the shop") and Order not ready after all ("When an order marked ready is moved back"), each with Edit and On.

#### Scenario: The list
- **WHEN** the Owner opens Settings › Messages
- **THEN** the six online order messages are listed under "Online order messages", and the "on" count counts the real list

#### Scenario: Switched off
- **WHEN** "Order still waiting" is switched off
- **THEN** an uncollected order's reminder is not sent

### Requirement: Order messages are draft wording until Jack approves it
Only "Order ready to collect" is drawn (`on-email-ready`); the other five SHALL carry draft wording, marked as draft in Settings › Messages, until Jack approves it. Every order message SHALL carry the order number and the private "See your order" link. Like every message, they SHALL be sent pretend until Jack says otherwise.

#### Scenario: The ready email
- **WHEN** Maya's order is marked ready and the few seconds pass
- **THEN** she is sent "Your order is ready to collect" ("Hi Maya, Your order [order number] is ready at North Street Cycles, Bolton. It’s paid — just give your name or order number at the counter.", See your order, "We’ll keep it for you until [date]. Can’t make it? Call us on [shop phone].")

#### Scenario: Pretend
- **WHEN** any order message goes
- **THEN** it is recorded as sent and nothing leaves the shop

### Requirement: Order confirmation goes when an order is paid
"Order confirmation" SHALL be queued when an order is paid, with the order number, what was bought, how it was paid, where to collect it and the private link, with no Undo wait: the customer has just paid.

#### Scenario: Paid
- **WHEN** Maya's payment goes through
- **THEN** "Order confirmation" goes to maya@example.test with the link back to her order

### Requirement: Staff see when an order email didn't arrive
When an order message couldn't reach the customer, the order's row on Online orders SHALL say "Email didn’t arrive · [phone]", as staff are told about booking messages that couldn't reach the customer.

#### Scenario: The ready email bounced
- **WHEN** "Order ready to collect" couldn't reach the customer
- **THEN** the order's row says "Email didn’t arrive · [phone]" with the customer's phone
