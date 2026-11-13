# Spec Delta

## ADDED Requirements

### Requirement: The daily figures are in Download everything
Download everything SHALL include a "Daily figures" list: one row per closed day, newest first, with the day, who closed it, the takings by how they were paid, the sales by category before VAT, the VAT where it is recorded, the cash difference, and whether the day was sent to accounts software, as plain numbers in pounds and pence. It SHALL be available whether or not accounts software is connected, and SHALL leave out a reopened day until it is closed again.

#### Scenario: a shop with no accounts software
- **WHEN** Jack downloads everything
- **THEN** the file has Daily figures with a row for each closed day, ready to import into accounts software

#### Scenario: a reopened day
- **WHEN** Wednesday is reopened
- **THEN** Daily figures has no row for Wednesday until it is closed again
