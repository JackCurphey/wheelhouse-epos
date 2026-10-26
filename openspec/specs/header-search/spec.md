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

### Requirement: The header search finds bikes
Typing at least two characters SHALL also find up to five of the shop's bikes, by make and model or frame number, listed in a Bikes group after Customers. Each one SHALL link to the bike's own page, showing its owner, colour and frame number under it. Removed bikes, and bikes of removed customers, SHALL not be found, and another shop's bikes never.

#### Scenario: a frame number
- **WHEN** Jo types the Trek's frame number
- **THEN** the Trek Domane AL 3 is listed under Bikes, with "Maya Patel" under it, and opens its page

#### Scenario: make and model
- **WHEN** Jo types "trek domane"
- **THEN** Maya's Trek is listed under Bikes
