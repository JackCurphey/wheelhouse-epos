# Spec Delta

## ADDED Requirements

### Requirement: A Shopify refund and another stock change at once both count
When a refund made in Shopify puts stock back while another change to the same product's stock (a sale, an adjustment, a delivery) is being made, both SHALL count: the refund SHALL add to the stock as it is when the refund is recorded, never to a figure read before. The refund's line in the product's stock history SHALL be recorded together with its stock change, or not at all.

#### Scenario: Stock taken off while a refund comes in
- **WHEN** a product has [n] in stock, three are taken off, and a Shopify refund of one arrives at the same moment
- **THEN** it has [n] − 3 + 1, with the refund's "Shopify refund" line in its history
