# Spec Delta

## Purpose

How Wheelhouse records money taken: each sale once, in whole pence, with VAT
per line; open orders kept in pence until they are paid; and how reports
count sales and check their totals while the old sales record is retired.

## ADDED Requirements

### Requirement: Amounts are stored in whole pence
Every amount the server stores or adds up for an order SHALL be a whole number of pence.

#### Scenario: Three lines
- **WHEN** an order has three lines of [amount] each and no discount
- **THEN** its total is exactly three times [amount], in pence, with no rounding left over

### Requirement: An order's total is its lines less its discount, never below zero
An order's total SHALL be the sum of its lines less its discount, and never below 0.

#### Scenario: A discount bigger than the lines
- **WHEN** an order's discount is more than its lines add up to
- **THEN** its total is 0

### Requirement: An open order is kept in pence until it is paid
An order not yet paid, such as a workshop job's order, SHALL keep its lines, its total and what has been paid towards it, in pence. A new order SHALL start with all of these at zero.

#### Scenario: A new job
- **WHEN** a job is created
- **THEN** it has an open order with a total of 0 and nothing paid

#### Scenario: Adding a part
- **WHEN** staff add a part costing [amount] to a job's open order
- **THEN** the order's total rises by [amount]

### Requirement: Converted amounts match their pounds values
When the move fills in pence for an existing order, each amount SHALL equal its pounds value times 100, exactly.

#### Scenario: An order from before the move
- **WHEN** an order stored as £[amount] before the move is read afterwards
- **THEN** its pence total is that amount times 100

### Requirement: The old app keeps seeing pounds until its screens go
While old-app screens (`public/app.js`) still read orders, the server SHALL keep giving them amounts in pounds, worked out from the pence it stores, and an order's status SHALL keep reading the way they understand.

#### Scenario: The old app's order page
- **WHEN** the old app opens an order after the move
- **THEN** it shows the same £ amounts as before

### Requirement: Reports count every sale exactly once across both records
Until the old sales tables have no writers, the dashboard, the sales list and a customer's history SHALL count sales from both the old tables and the till sales record, each exactly once, in pence.

#### Scenario: A day with both
- **WHEN** a day has one sale in the old tables and one till sale
- **THEN** that day's dashboard total is the two added together, and its count is two

#### Scenario: A customer's history
- **WHEN** a customer has an old sale and a till sale
- **THEN** both appear once in their history, newest first by when the sale was made

### Requirement: A sale is opened by its record and number
The sales list and a customer's history SHALL tell each sale's record apart, so opening a sale shows that sale, even when an old sale and a till sale have the same number.

#### Scenario: The same number in both records
- **WHEN** old sale [n] and till sale [n] both exist and staff open the till sale
- **THEN** the till sale is shown

### Requirement: Online shop orders still count in the day's takings
An order from the shop's Shopify store SHALL still be recorded once and counted in that day's takings, through the move.

#### Scenario: An order from the online shop
- **WHEN** a Shopify order arrives after reports read both records
- **THEN** it counts once in that day's dashboard total

### Requirement: The totals check finds every mismatch
A totals check SHALL compare every converted amount with its pounds value, every order's lines with its total (never below 0), every sale's lines and payments with its total, and each shop's daily takings with a saved baseline. It SHALL report each mismatch with the record and both amounts.

#### Scenario: A clean database
- **WHEN** the totals check runs on a database where every amount adds up
- **THEN** it reports no mismatches, and how many records it checked

#### Scenario: A mismatch
- **WHEN** an order's lines add up to 1p more than its total
- **THEN** the check names that order and both amounts
