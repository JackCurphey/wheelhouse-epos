# Spec Delta

## ADDED Requirements

### Requirement: The Owner makes a computer a workshop computer
The Owner, signed in, SHALL be able to make the computer they are on a workshop computer from Set up this computer: "A workshop computer", the shop as pills, "Name (optional)", and "Make this computer a workshop computer", with no till number. It SHALL stay a workshop computer when people sign in and out on it, kept as a key of the browser's own, stored only hashed.

#### Scenario: The workshop's computer
- **WHEN** Jack Lewis, the Owner, chooses "A workshop computer" and Bolton and presses "Make this computer a workshop computer"
- **THEN** the computer becomes a workshop computer at Bolton

### Requirement: Only the Owner sets up a workshop computer, once per computer
Nobody but the signed-in Owner SHALL set up a workshop computer, and not while someone else is checked in on it by PIN. A computer that is a till or a workshop computer SHALL not be made either again.

#### Scenario: Already a till
- **WHEN** the Owner asks to make Till B1's computer a workshop computer
- **THEN** it is refused, and it stays Till B1

#### Scenario: Staff
- **WHEN** Jo Taylor asks the server to set up a workshop computer
- **THEN** it is refused

### Requirement: A workshop computer asks for a PIN before anything
On a workshop computer with nobody working, every staff page SHALL show "Enter your PIN" under a bar reading "Workshop computer", the site and shop, and "Nobody working — enter your PIN", with no till number, no "Checked in today" and no "No PIN yet?" line. A PIN SHALL make that person the one working and open the page that was asked for; the front page SHALL open the diary.

#### Scenario: Alex starts work
- **WHEN** Alex Morgan types his PIN on the workshop computer
- **THEN** the diary opens with "Working: Alex Morgan · Switch" at the top

### Requirement: Every page on a workshop computer says who is working
While someone is working on a workshop computer, every page SHALL show "Working: [name] · Switch" at the top. Switch SHALL end their check-in and show Enter your PIN.

#### Scenario: Switch
- **WHEN** Alex Morgan presses Switch
- **THEN** Enter your PIN shows, and nobody is working

### Requirement: A workshop computer left alone goes back to Enter your PIN
A workshop computer SHALL go back to Enter your PIN after 10 minutes with nobody using it. The server SHALL stop counting the check-in 10 minutes after it was last used, whatever the screen does. A till SHALL stay checked in.

#### Scenario: A break
- **WHEN** Alex Morgan leaves the workshop computer for 10 minutes
- **THEN** it shows Enter your PIN, and nothing more is done as Alex until a PIN is typed

#### Scenario: Still working
- **WHEN** Alex Morgan keeps using the workshop computer
- **THEN** it stays his

## MODIFIED Requirements

### Requirement: A check-in belongs to its shop and its till
A check-in SHALL count only in its own shop, on the browser and sign-in it was made on, on the till or workshop computer it was made on, and only on the shop's day it was made. On a workshop computer it SHALL also stop counting 10 minutes after it was last used.

#### Scenario: Another shop
- **WHEN** a check-in made at one shop is sent to another
- **THEN** nobody is serving there

#### Scenario: The browser became a till
- **WHEN** Jo Taylor checked in on a browser and the Owner then makes it Till B1
- **THEN** nobody is serving on Till B1 until someone checks in there

#### Scenario: The workshop computer and the till
- **WHEN** Alex Morgan checks in on the workshop computer
- **THEN** he is not checked in on Till B1, and the workshop computer's check-in doesn't count on a browser that is neither
