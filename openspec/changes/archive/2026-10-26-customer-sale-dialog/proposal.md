# Proposal: open a sale from a customer's history

## Why

A customer's page lists their sales, but a sale opens nothing yet
(`decided-while-building.md`, 24 Oct, customer page, item 1: "until their
pages exist"). The drawing `cs-sale` (`docs/design/user-journeys/generator/customer.mjs:301`,
customer service review decisions 2 and 12) is that page: a pop-up with what
was bought, the total, how it was paid, "Print the receipt" and "Refund at
the till". This is WP-3.2, Jack's lane. Nobody has claimed it.

**Risky area:** none. It only reads sales. The history's sales query moves to
the `all_sales` view, so a till sale shows too.

## What Changes

- **A customer's history lists sales from both records** (`all_sales`), each
  marked with its source.
- **A sale in the history opens the drawn pop-up:**
  - "Sale [receipt number or id]";
  - a line with when, who served and the customer;
  - each line with its quantity and amount;
  - Total, then "Paid by";
  - "Print the receipt".

## Capabilities

### Modified Capabilities

- `customers`: a sale in a customer's history opens.

## Out of scope

- **"Refund at the till":** refunds aren't built, so it's left out until they
  are.
- **"Till B1":** neither record holds which till a sale was on yet.
- **Printing a till sale:** the printed receipt reads the old record; a till
  sale's pop-up shows without Print until the new record's receipt exists
  (step C).
