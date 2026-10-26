## ADDED Requirements

### Requirement: The Owner can set up the shop's own automatic messages

The Owner SHALL be able to add, change and remove the shop's own messages, each with a name, when it goes (after a job is collected, before a booked job, or after a sale), how many days or months after or before, text or email or both, and its wording. Anyone else SHALL be refused, as for Settings.

#### Scenario: adding one
- **WHEN** the Owner adds "Spring check" to go 6 months after a job is collected, by email, with wording
- **THEN** it is listed, on

#### Scenario: something missing
- **WHEN** the name or wording is blank, the number isn't a whole number from 1 to 365 days or 1 to 24 months, or neither text nor email is chosen
- **THEN** it is refused with a line saying what to fix

### Requirement: A shop's own message goes only to customers who said yes to offers and news

A shop's own message SHALL go only to a customer who said yes to offers and news and hasn't stopped that message, by the customer's chosen way when the message is sent that way, else by the other way the message is sent that the customer has. It SHALL go once per job or sale, only while the shop is open, and only for a collection, booked day or sale whose time came after the message was set up, retimed or switched on.

#### Scenario: six months after collection
- **WHEN** Maya said yes to offers and news and her bike was collected six months ago, and the shop is open
- **THEN** "Spring check" goes to her once, with the shop's wording, ending "Stop these: [link]", its email subject "Spring check"

#### Scenario: no yes
- **WHEN** a customer hasn't said yes to offers and news
- **THEN** nothing goes to them

#### Scenario: a sale with no customer
- **WHEN** a message goes after a sale, and a sale has no customer on it
- **THEN** nothing goes for that sale

### Requirement: Stop these stops just that message

The link at the end of a shop's own message SHALL stop that message for that customer only; their other messages and their yes to offers and news SHALL stay as they are. Pressing again SHALL turn it back on.

#### Scenario: stopping one of two
- **WHEN** Maya stops "Spring check" from its link
- **THEN** she gets no more "Spring check", and still gets the shop's other own messages
