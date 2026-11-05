## ADDED Requirements

### Requirement: Every stock change says who, why, which shop and what caused it
Every change to a product's stock SHALL write a line in its history saying who made it, why, at which shop where one is known, and what caused it. Who SHALL be the person at the computer, not only the sign-in, and SHALL still be named if that person is later removed. A change no person made, such as a Shopify refund, SHALL name nobody and say what caused it.

#### Scenario: Jo Taylor at the Owner's till
- **WHEN** Jo Taylor is checked in on a till at Bolton signed in as Jack Lewis, and adjusts Shimano brake pads
- **THEN** the line names Jo Taylor and Bolton, and the history and Today say Jo Taylor

#### Scenario: A delivery
- **WHEN** Jack Lewis books in a delivery against an order
- **THEN** each line names him, the order and the delivery

#### Scenario: A line from before
- **WHEN** a line was written before this
- **THEN** it keeps the name it recorded

### Requirement: Nobody checked in, nothing changes
On a till or workshop computer with nobody checked in, adjusting stock, adding or importing a product with stock, and applying or undoing a count SHALL ask for a PIN and change nothing. Sales SHALL carry on as they do today.

#### Scenario: Adjusting at an empty till
- **WHEN** nobody is checked in on a till and Adjust is pressed
- **THEN** it says "Check in with your PIN first" and the stock doesn't change

### Requirement: All stock changes go through one place
Nothing in the server SHALL change a product's stock or write a stock line except the one function for it.

#### Scenario: A sale, a refund and a count at once
- **WHEN** a sale, a Shopify refund and an applied count change one product at the same moment
- **THEN** all three count, each with its own line

### Requirement: A stock change never hangs on a held product
A stock change SHALL wait a short time for a product something else holds, then say Wheelhouse is busy and change nothing. A till's sale SHALL be sent again by the till, and a Shopify refund again by Shopify, and each SHALL then count once. A Shopify order SHALL wait longer, as it can't be sent again.

#### Scenario: Adjusting a held product
- **WHEN** a product is held and someone adjusts it
- **THEN** within seconds they're told Wheelhouse is busy, and the stock and history are unchanged

#### Scenario: A till's sale while the product is held
- **WHEN** a till's sale reaches a held product
- **THEN** the till is told to send again, and when it does the sale counts once

### Requirement: A supplier's item imported with stock has a history line
Importing a supplier's item with stock SHALL write a line in the new product's history saying where it came from.

#### Scenario: Importing an item with stock
- **WHEN** Jack Lewis imports an item with [n] in the supplier's feed
- **THEN** the product starts with [n] and a line saying it was imported from that supplier's catalogue, naming him
