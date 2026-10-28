# Spec Delta

## ADDED Requirements

### Requirement: A Shopify refund and another stock change at once both count
When a refund made in Shopify puts stock back while another change to the same product's stock (a sale, an adjustment, a delivery) is being made, both SHALL count: the refund SHALL add to the stock as it is when the refund is recorded, never to a figure read before. The refund's line in the product's stock history SHALL be recorded together with its stock change, or not at all. The stock figure Wheelhouse then sends to Shopify SHALL be the stock after both changes.

#### Scenario: Stock taken off while a refund comes in
- **WHEN** a product has [n] in stock, three are taken off, and a Shopify refund of one arrives at the same moment
- **THEN** it has [n] − 3 + 1, with the refund's "Shopify refund" line in its history, and Shopify is sent [n] − 3 + 1

### Requirement: A failed Shopify refund is applied when Shopify sends it again
A Shopify refund that fails partway SHALL change no stock and write no history line, and SHALL be recorded as failed. When Shopify sends the same refund again, it SHALL be applied.

#### Scenario: A refund fails, then Shopify retries it
- **WHEN** a refund of two products fails on the second
- **THEN** neither product's stock changes, and when Shopify sends it again both go back

### Requirement: A Shopify refund sent twice counts once
The same Shopify refund received more than once, one after the other or at the same moment, SHALL put its stock back once, with one history line.

#### Scenario: The same refund arrives twice at once
- **WHEN** Shopify sends one refund of one item twice at the same moment
- **THEN** the stock goes up by one, with one "Shopify refund" line

### Requirement: A Shopify refund that doesn't restock leaves stock alone
A refund line that Shopify marks as not restocked (`no_restock`: the money goes back, the item doesn't go back on the shelf) SHALL leave the product's stock and its history unchanged. Other lines of the same refund SHALL be put back.

#### Scenario: One line restocked, one not
- **WHEN** a refund has one line marked `no_restock` and one marked `return`
- **THEN** only the `return` line's product goes back up
