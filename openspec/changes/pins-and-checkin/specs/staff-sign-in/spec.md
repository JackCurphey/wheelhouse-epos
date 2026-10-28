# Spec Delta

## ADDED Requirements

### Requirement: Wheelhouse picks each person's till PIN
A person's till PIN SHALL be four digits picked at random by Wheelhouse, which nobody else at the shop has; nobody chooses their own, so choosing can't reveal a colleague's (signing in 4 and 7; `pin-change`). "Give me a different one" SHALL show another. "Keep this PIN" SHALL keep only the PIN shown, within 15 minutes of showing it, and SHALL refuse it if someone else kept it meanwhile. Keeping a new PIN SHALL stop the old one working.

#### Scenario: A new PIN
- **WHEN** Jo Taylor asks for a new PIN and keeps the one shown
- **THEN** that PIN checks her in, and her old one doesn't

#### Scenario: No choosing
- **WHEN** someone tries to keep a PIN Wheelhouse didn't show them
- **THEN** it is refused

### Requirement: PINs are never kept in plain text
The server SHALL keep only a slow, salted hash of each PIN and of each PIN offered, and SHALL never write a PIN to its log.

#### Scenario: Looking in the database
- **WHEN** someone reads a person's row
- **THEN** they see a hash, not the PIN

### Requirement: The Owner clears a forgotten PIN
The Owner SHALL be able to clear someone else's till PIN, so they can't check in until they get a new one (signing in 6; roles and switches 5: nobody clears their own). Until roles, only the Owner SHALL clear a PIN.

#### Scenario: Jo forgot her PIN
- **WHEN** Jack Lewis clears Jo Taylor's PIN
- **THEN** her old PIN no longer checks her in

### Requirement: Check in at the till with your PIN alone
The till SHALL ask "Enter your PIN" when nobody is serving on it, and the PIN alone SHALL say who is checking in: no name first (signing in 4; `till-checkin`). The fourth digit SHALL be checked at once, with no OK button. The person checked in SHALL be serving until they switch, someone else checks in on that till, or the shop's day ends.

#### Scenario: Jo checks in
- **WHEN** Jo Taylor types her four digits on the till
- **THEN** the till shows "Serving: Jo Taylor" and her sales go under her name

#### Scenario: Taking over
- **WHEN** Alex Morgan types his PIN on the till Jo Taylor is serving on
- **THEN** Alex Morgan is serving

### Requirement: A wrong PIN says so, with no lock
A PIN nobody has SHALL clear the dots and say "That PIN isn’t anyone’s — try again", and SHALL never lock the till (signing in 8 and 9; `till-pin-wrong`). After 10 wrong PINs in 10 minutes at one shop, each further try SHALL be slowed, so a PIN can't be found by trying them all quickly.

#### Scenario: A slip of the finger
- **WHEN** Jo Taylor types a PIN nobody has
- **THEN** the dots clear and the till says "That PIN isn’t anyone’s — try again"

### Requirement: The PIN screen shows who's checked in today
The PIN screen SHALL list "Checked in today" with everyone who has checked in at the shop that day, and say "No PIN yet? Sign in on your phone." (signing in 4; UX walk-through 4 H1; the drawn "or ask the owner or a manager to give you one here" comes with giving a PIN at the till, `till-give-pin`).

#### Scenario: Second in
- **WHEN** Alex Morgan checked in this morning and Jo Taylor comes to the till
- **THEN** the PIN screen lists Alex Morgan under Checked in today

### Requirement: A check-in belongs to its shop and its till
A check-in SHALL count only in its own shop, on the browser and sign-in it was made on, and only on the shop's day it was made.

#### Scenario: Another shop
- **WHEN** a check-in made at one shop is sent to another
- **THEN** nobody is serving there
