# header-search Specification

## Purpose
TBD - created by archiving change header-search. Update Purpose after archive.

## Requirements

### Requirement: Find jobs and customers from any staff page

Every staff page SHALL have the header search. Typing at least two characters
SHALL find up to five jobs (by job number, the customer's name or phone, or
the bike) and up to five customers (by name, phone or email), each a link to
its page, grouped Jobs then Customers, with a live count. Removed customers
SHALL not be found, and another shop's jobs and customers never.

#### Scenario: a name
- **WHEN** Jo types "maya" in the header search
- **THEN** Maya Patel's jobs and Maya Patel are listed, each opening its page

#### Scenario: a job number
- **WHEN** Jo types "WH-1042"
- **THEN** that job is listed first and opens in the diary

#### Scenario: nothing found
- **WHEN** nothing matches what was typed
- **THEN** the search says "Nothing matches “[what was typed]”"

#### Scenario: on a phone
- **WHEN** Jo taps the search button on a phone
- **THEN** the box and its results open over the page, with Close search
