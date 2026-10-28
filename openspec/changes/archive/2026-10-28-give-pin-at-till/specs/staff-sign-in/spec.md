# Spec Delta

## ADDED Requirements

### Requirement: The Owner gives a PIN at the till
The Owner checked in at the till SHALL be able to give a till PIN to someone at the shop who has none, with the screen turned to them (UX walk-through 4 M2 and M3; Jack's answers 28 Oct, 3 to 5; `till-give-pin`). Wheelhouse SHALL pick the PIN as it does in Your settings: four digits nobody else at the shop has, "Give me a different one", and "Keep this PIN" keeping only the PIN shown, within 15 minutes. Keeping it SHALL take the till back to Enter your PIN. Until roles, only the Owner SHALL give a PIN; nobody SHALL give a PIN to themselves, and nobody SHALL give the Owner a PIN.

#### Scenario: A till-only person's first PIN
- **WHEN** Jack Lewis, checked in, gives [Name] their PIN and [Name] keeps it
- **THEN** the till goes back to Enter your PIN, and [Name]'s PIN checks them in

#### Scenario: Someone who isn't the Owner
- **WHEN** Jo Taylor is checked in and asks the server to give someone a PIN
- **THEN** it is refused

#### Scenario: Someone who already has a PIN
- **WHEN** the Owner asks to give a PIN to Alex Morgan, who has one
- **THEN** it is refused, and Alex Morgan's PIN still works

### Requirement: Serving opens a menu while someone has no PIN
For the Owner, and only while someone at the shop has no PIN, "Serving: [name]" SHALL open a menu with "Switch who’s serving" and the PIN to give (`till-serving-menu`, `till-serving-menu-several`). With one person it SHALL offer "Give [Name] their PIN"; with several, "Give someone their PIN" with "[n] people have no PIN yet", which opens "Who’s getting a PIN?" listing them (`till-give-pin-pick`). Otherwise Serving SHALL stay one tap back to Enter your PIN.

#### Scenario: Two people with no PIN
- **WHEN** Jo Taylor and [Name] have no PIN and Jack Lewis taps Serving
- **THEN** the menu offers "Give someone their PIN · 2 people have no PIN yet"

#### Scenario: Everyone has a PIN
- **WHEN** everyone at the shop has a PIN and Jack Lewis taps Serving
- **THEN** the till goes straight back to Enter your PIN

## MODIFIED Requirements

### Requirement: The PIN screen shows who's checked in today
The PIN screen SHALL list "Checked in today" with everyone who has checked in at the shop that day, and say "No PIN yet? Sign in on your phone, or ask the owner or a manager to give you one here." (signing in 4; UX walk-through 4 H1; `till-checkin`).

#### Scenario: Second in
- **WHEN** Alex Morgan checked in this morning and Jo Taylor comes to the till
- **THEN** the PIN screen lists Alex Morgan under Checked in today
