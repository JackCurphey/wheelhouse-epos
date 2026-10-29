# Spec Delta

## ADDED Requirements

### Requirement: The Owner sets trust PIN and how long a workshop computer waits
Settings › Front desk › Till SHALL have a "Signing in" fold, after Tills, with "Trust PIN", off to start (roles and switches 3 and 9; stage-1 gaps 9). Only while it is on SHALL it offer how long before a workshop computer goes back to the start when left alone: 5, 10, 15 or 30 minutes, or Off; 10 to start. Each SHALL save when chosen, for the whole business (shops and sites 1). Until roles, only the Owner SHALL change them.

#### Scenario: Switching trust PIN on
- **WHEN** Jack Lewis, the Owner, opens Signing in and switches Trust PIN on
- **THEN** it is saved, and the choices 5, 10, 15 and 30 minutes and Off show with 10 minutes chosen

#### Scenario: Trust PIN off
- **WHEN** trust PIN is off
- **THEN** no choice of time shows, and a workshop computer goes back after 10 minutes

#### Scenario: Staff
- **WHEN** Jo Taylor asks the server to switch trust PIN on
- **THEN** it is refused

### Requirement: Who's working? on a workshop computer with trust PIN on
On a workshop computer with trust PIN on and nobody working, when anyone has typed their PIN there today, every staff page SHALL show "Who's working?" (`till-checkin-workshop-names`): a name to tap, with Mechanic or Staff, for each of them, and "Someone else — enter your PIN" for the PIN pad. Tapping a name SHALL make that person the one working. It SHALL show after the computer is left alone and after Switch (stage-1 gaps 10). The Owner SHALL not be offered as a name.

#### Scenario: The words
- **WHEN** "Who’s working?" shows
- **THEN** the bar says "Nobody working — tap your name", and the line under the heading says "You’ve typed your PIN here today, so just tap your name."

#### Scenario: The Owner types their PIN
- **WHEN** Jack Lewis, the Owner, typed his PIN on the workshop computer today and it has been left alone
- **THEN** "Who’s working?" doesn't list him, and he uses "Someone else — enter your PIN"

#### Scenario: Back from a break
- **WHEN** Alex Morgan and Jo Taylor typed their PINs on the workshop computer this morning, trust PIN is on, and the computer has been left alone
- **THEN** it shows "Who’s working?" with Alex Morgan and Jo Taylor, and Alex taps his name and the diary shows "Working: Alex Morgan · Switch"

#### Scenario: Nobody yet today
- **WHEN** trust PIN is on and nobody has typed their PIN on the workshop computer today
- **THEN** it shows Enter your PIN

### Requirement: A tap counts only for someone who typed their PIN there today
The server SHALL check someone in by a tap only on a workshop computer, with trust PIN on, for someone active who typed their PIN on that same workshop computer on the shop's day, since their PIN was last cleared, and who is not the Owner. Any other tap SHALL be refused and nobody SHALL be checked in by it.

#### Scenario: Never typed here
- **WHEN** Jo Taylor typed her PIN only on Till B1 today and her name is sent as a tap on the workshop computer
- **THEN** it is refused

#### Scenario: Trust PIN off
- **WHEN** trust PIN is off and Alex Morgan's name is sent as a tap
- **THEN** it is refused, even though he typed his PIN there today

#### Scenario: Not on a workshop computer
- **WHEN** a tap is sent from a till
- **THEN** it is refused

## MODIFIED Requirements

### Requirement: A check-in belongs to its shop and its till
A check-in SHALL count only in its own shop, on the browser and sign-in it was made on, on the till or workshop computer it was made on, and only on the shop's day it was made. On a workshop computer it SHALL also stop counting once it has gone unused for the shop's time: 10 minutes with trust PIN off; with trust PIN on, the time chosen, or never when Off is chosen; the Owner's own, 10 minutes at most.

#### Scenario: Another shop
- **WHEN** a check-in made at one shop is sent to another
- **THEN** nobody is serving there

#### Scenario: The browser became a till
- **WHEN** Jo Taylor checked in on a browser and the Owner then makes it Till B1
- **THEN** nobody is serving on Till B1 until someone checks in there

#### Scenario: The workshop computer and the till
- **WHEN** Alex Morgan checks in on the workshop computer
- **THEN** he is not checked in on Till B1, and the workshop computer's check-in doesn't count on a browser that is neither

### Requirement: A workshop computer left alone goes back to Enter your PIN
A workshop computer SHALL go back to the start after the shop's time with nobody using it: 10 minutes with trust PIN off; with trust PIN on, 5, 10, 15 or 30 minutes as chosen, or never when Off is chosen. The Owner's own check-in SHALL wait 10 minutes at most. The server SHALL stop counting the check-in at that time after it was last used, whatever the screen does. A till SHALL stay checked in.

#### Scenario: A break
- **WHEN** Alex Morgan leaves the workshop computer for 10 minutes with trust PIN off
- **THEN** it shows Enter your PIN, and nothing more is done as Alex until a PIN is typed

#### Scenario: A shorter time
- **WHEN** trust PIN is on with 5 minutes chosen, and Alex Morgan leaves the workshop computer for 5 minutes
- **THEN** it goes back to the start, and nothing more is done as Alex until he is chosen again

#### Scenario: Off
- **WHEN** trust PIN is on with Off chosen, and Alex Morgan leaves the workshop computer for an hour
- **THEN** it stays his

#### Scenario: Still working
- **WHEN** Alex Morgan keeps using the workshop computer
- **THEN** it stays his

#### Scenario: The Owner walks away
- **WHEN** trust PIN is on with Off or 30 minutes chosen, and Jack Lewis, the Owner, typed his PIN on the workshop computer and leaves it for 10 minutes
- **THEN** it goes back to the start, so whoever is next doesn't have the Owner's pages
