## MODIFIED Requirements

### Requirement: Settings › Till › Tills offers "Make this computer a till"
For the Owner, Settings › Front desk › Till SHALL have a Tills section after Receipts, summarised by the shop's tills ("Till B1") or "None yet". It SHALL list every till that is switched on, in number order, then every workshop computer that is switched on, each with where and when it was registered and by whom, Rename and Remove (`set-till-tills-owner`), then the drawn note and "Make this computer a till", which opens Set up this till (stage-1 gaps 4). The button SHALL not show on a computer that is already a till, nor for a business with no site yet.

#### Scenario: Jack sets up the first till
- **WHEN** Jack Lewis opens Settings › Till › Tills on the shop's counter computer
- **THEN** he sees "Make this computer a till", which opens Set up this till

#### Scenario: Already a till
- **WHEN** the computer is Till B1
- **THEN** Tills reads "Till B1" and there is no "Make this computer a till"

#### Scenario: The list
- **WHEN** Jack Lewis registered Till B1 at Bolton on 1 September and opens Tills
- **THEN** he sees "Till B1" over "Bolton · registered Tue 1 Sep by Jack Lewis", with Rename and Remove

## ADDED Requirements

### Requirement: The Owner renames a till or a workshop computer
Rename SHALL open a box with the till's or workshop computer's "Name (optional)", up to 60 characters, saved with Save; a blank name SHALL leave it with none. A named till's row SHALL read "Till B1 · [name]". Only the Owner SHALL rename, and not while someone else is checked in by PIN on the computer making the change.

#### Scenario: Naming a till
- **WHEN** Jack Lewis renames Till B1 "Front counter"
- **THEN** the row reads "Till B1 · Front counter"

#### Scenario: Clearing a name
- **WHEN** he empties the name and saves
- **THEN** the row reads "Till B1"

### Requirement: Removing a till or a workshop computer asks first
Remove SHALL ask first (`set-till-remove`): "Remove Till B1?", "Bolton", "This computer stops working as a till. Sales already taken stay in the reports.", "Keep the till" and "Remove the till". Removing SHALL switch it off: that computer stops being the till at once, its number stays in use, and what was done on it stays. A workshop computer SHALL be removed the same way. Only the Owner SHALL remove, and not while someone else is checked in by PIN on the computer making the change.

#### Scenario: Keeping the till
- **WHEN** Jack Lewis presses Remove on Till B1, then Keep the till
- **THEN** nothing changes

#### Scenario: Removing the till
- **WHEN** he presses Remove the till
- **THEN** Till B1 leaves the list, that computer is no longer Till B1, and B1 is still "In use" when setting up a till

#### Scenario: Removing a workshop computer
- **WHEN** he presses Remove on the workshop computer
- **THEN** he is asked "Remove the workshop computer?", "This computer stops working as a workshop computer."
- **WHEN** he presses Remove the workshop computer
- **THEN** it leaves the list and that computer goes back to being an ordinary signed-in browser

#### Scenario: A removed workshop computer still signed in as the Owner
- **WHEN** the workshop computer Jack Lewis removed is still signed in as him
- **THEN** it gets no Owner pages, even after signing in again there, until he signs out there and signs back in
