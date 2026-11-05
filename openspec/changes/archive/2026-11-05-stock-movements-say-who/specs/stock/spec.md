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
A stock change SHALL wait a short time for a product something else holds, then say Wheelhouse is busy and change nothing. A till's sale SHALL be sent again by the till, and a Shopify order or refund again by Shopify, and each SHALL then count once. Staff SHALL be told Wheelhouse is busy, not that something failed, and at the till SHALL NOT be told to reverse a card payment for it.

#### Scenario: Adjusting a held product
- **WHEN** a product is held and someone adjusts it
- **THEN** within seconds they're told Wheelhouse is busy, and the stock and history are unchanged

#### Scenario: A till's sale while the product is held
- **WHEN** a till's sale reaches a held product
- **THEN** the till is told to send again, and when it does the sale counts once

#### Scenario: A Shopify order while the product is held
- **WHEN** a Shopify order reaches a held product, and Shopify sends it again
- **THEN** the first changes nothing, and the second sells it once with one line

#### Scenario: A paid Shopify order with an item at nothing
- **WHEN** a Shopify order has one item with none in stock and another with some
- **THEN** both lines are recorded, the first goes below zero, and it shows in Today's below-zero warning

#### Scenario: A paid Shopify order with a product taken off sale
- **WHEN** a Shopify order has one product taken off sale here and another on sale
- **THEN** both lines are recorded with their stock changes, and the product stays off sale, refused at the till and everywhere else

#### Scenario: A job already paid
- **WHEN** an answer was lost on a job's card payment and Card approved is pressed again
- **THEN** the till says the sale was recorded and not to take payment again

#### Scenario: A card sale at a busy moment
- **WHEN** Card approved is pressed and Wheelhouse is busy
- **THEN** it says the sale isn't recorded yet and to try again, and that if the card machine took the payment not to take it again

### Requirement: Applying a very large count doesn't stop the shop
Applying a count SHALL hold its products as briefly as it can. A sale of one of them during a very large count (50,000 products) MAY be told to try again for about 6 seconds, and SHALL then go through.

#### Scenario: A sale during a large count
- **WHEN** a count of 50,000 products is being applied and one of them is sold
- **THEN** the sale goes through, after being told to try again if it had to wait over 2 seconds

### Requirement: A supplier's item imported with stock has a history line
Importing a supplier's item with stock SHALL write a line in the new product's history saying where it came from.

#### Scenario: Importing an item with stock
- **WHEN** Jack Lewis imports an item with [n] in the supplier's feed
- **THEN** the product starts with [n] and a line saying it was imported from that supplier's catalogue, naming him
