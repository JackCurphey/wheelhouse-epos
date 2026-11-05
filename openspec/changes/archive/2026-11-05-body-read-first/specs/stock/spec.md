# Spec Delta

## MODIFIED Requirements

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
- **THEN** it says the sale may not be recorded yet and to try again, and that if the card machine took the payment not to take it again
