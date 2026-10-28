# Spec Delta

## ADDED Requirements

### Requirement: The Owner makes a computer a till
The Owner, signed in, SHALL be able to make the computer they are on a till from "Set up this till" (`till-setup`): the shop as pills, the till number as pills with numbers used at that shop "In use", "Name (optional)", and "Make this computer Till [code]". The code SHALL be the shop's code and the number (B1). The computer SHALL stay that till when people sign in and out on it.

#### Scenario: Bolton's first till
- **WHEN** Jack Lewis, the Owner, chooses Bolton and B1 and presses "Make this computer Till B1"
- **THEN** the computer becomes Till B1, and the till shows "Till B1" and "Bolton · North Street Cycles"

#### Scenario: Numbers in use
- **WHEN** [Second site] already has [code]1 and [code]2
- **THEN** they show "In use" and [code]3 is chosen

### Requirement: Only the Owner sets up a till, once per computer
Nobody but the signed-in Owner SHALL set up a till, never by PIN alone (roles and switches 2). A computer that is already a till SHALL not be made another, and a number in use at that shop SHALL be refused.

#### Scenario: Already a till
- **WHEN** the Owner asks to make Till B1's computer another till
- **THEN** it is refused, and it stays Till B1

#### Scenario: Staff
- **WHEN** Jo Taylor asks the server to set up a till
- **THEN** it is refused

### Requirement: The till's browser key opens nothing on its own
The computer SHALL keep its till as a key of its own, apart from the offline till's, stored only hashed. It SHALL only say which till a signed-in browser is: copied out of the browser, it SHALL never open the till's offline copy or send sales, and the offline till's key SHALL never be kept by the browser. It SHALL be renewed whenever the till is used.

#### Scenario: Copied from the browser
- **WHEN** someone copies Till B1's key from the browser and asks for the till's offline copy with it
- **THEN** it is refused

### Requirement: The Owner can make a new computer an existing till
The Owner SHALL be able to make this computer an existing till, in place of the one that had it (a lost key or a replaced computer); the computer that had it SHALL stop being that till. No screen SHALL offer it until it is drawn.

#### Scenario: A replaced computer
- **WHEN** the Owner makes a new computer Till B1 again
- **THEN** the new computer is Till B1 and the old one is no till

### Requirement: Nobody else checked in sets up a till
When someone other than the Owner is checked in by PIN on a computer, a till SHALL not be set up on it, even under the Owner's sign-in.

#### Scenario: Jo is serving
- **WHEN** Jo Taylor is checked in on the computer and a till is asked for there
- **THEN** it is refused

## MODIFIED Requirements

### Requirement: The PIN screen shows who's checked in today
The PIN screen SHALL list "Checked in today" with everyone who has checked in on this till that day (on a computer that isn't a set-up till, everyone who checked in on one that isn't), and say "No PIN yet? Sign in on your phone, or ask the owner or a manager to give you one here." (signing in 4; UX walk-through 4 H1; `till-checkin`).

#### Scenario: Second in
- **WHEN** Alex Morgan checked in on Till B1 this morning and Jo Taylor comes to Till B1
- **THEN** the PIN screen lists Alex Morgan under Checked in today

#### Scenario: Another till
- **WHEN** Alex Morgan checked in on Till B1 and Jo Taylor comes to Till B2
- **THEN** Till B2's PIN screen doesn't list Alex Morgan

### Requirement: A check-in belongs to its shop and its till
A check-in SHALL count only in its own shop, on the browser and sign-in it was made on, on the till it was made on, and only on the shop's day it was made.

#### Scenario: Another shop
- **WHEN** a check-in made at one shop is sent to another
- **THEN** nobody is serving there

#### Scenario: The browser became a till
- **WHEN** Jo Taylor checked in on a browser and the Owner then makes it Till B1
- **THEN** nobody is serving on Till B1 until someone checks in there
