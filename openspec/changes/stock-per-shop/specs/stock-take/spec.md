## ADDED Requirements

### Requirement: A count belongs to the shop it was started at
A count SHALL belong to the shop it was started at: a till or workshop computer's own, otherwise the business's oldest. What's expected, what's allowed for, what's taken as not counted, Apply and Undo SHALL all be that shop's, whichever computer presses them, and SHALL leave any other shop's figure alone. A count already running when this arrives SHALL belong to the oldest shop.

#### Scenario: Counting at the second shop
- **WHEN** a count is started at a till at [Second site], with 5 at the first shop and 3 at [Second site], and 2 are counted
- **THEN** 3 are expected, Apply takes [Second site] to 2, the first shop stays at 5, and Undo takes [Second site] back to 3

#### Scenario: A sale at the other shop during a count
- **WHEN** a product is counted at one shop and then sold at another
- **THEN** that sale isn't allowed for and doesn't change the difference; a sale at the shop counting is, and does as it always has
