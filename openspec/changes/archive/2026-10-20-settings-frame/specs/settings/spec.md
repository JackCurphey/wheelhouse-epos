## ADDED Requirements

### Requirement: Settings is arranged in rooms with folding sections
Settings SHALL show the rooms that have something built down the left (Front desk, Workshop, Office), each room's page with its areas and, for more than one area, Jump to; each setting SHALL sit in a fold with a one-line summary of what is set up; on a phone Settings SHALL open on the list of rooms, each room its own page with "‹ Settings" back (drawn in settings-frame.mjs).

#### Scenario: Opening Settings on a computer
- **WHEN** the Owner opens Settings
- **THEN** Front desk shows, with Jump to Till and Messages, and the Receipts fold open

#### Scenario: A fold's summary
- **WHEN** the shop is closed on Sundays
- **THEN** Office's Opening hours fold reads "Closed Sundays" while closed
