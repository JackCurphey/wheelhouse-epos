## ADDED Requirements

### Requirement: On a computer, Add photo offers Use my phone

On a computer, a draft quote line's "Add photo" SHALL offer "Choose a file" and "Use my phone". On a tablet or phone it SHALL go straight to the camera or file picker.

#### Scenario: Alex chooses Use my phone

- **WHEN** Alex clicks "Add photo for Shimano brake pads" on WH-1042 at the workshop computer
- **THEN** he can choose "Choose a file" or "Use my phone"

### Requirement: A code to scan adds one photo to one line within 15 minutes

"Use my phone" SHALL show a code to scan and a link to type that open that line's photo step on a phone with no sign-in. The code SHALL work for 15 minutes and for one photo only, then stop working. The photo SHALL go on that line as a chosen file would, its hidden details removed.

#### Scenario: Alex adds the pads photo from his phone

- **WHEN** Alex scans the code, takes a photo of the worn rear pads and taps "Use this photo"
- **THEN** the Shimano brake pads line has the photo, it is among the job's files, and the phone says "Photo added to WH-1042"

#### Scenario: The code is used once

- **WHEN** the code is opened again after the photo was added
- **THEN** the phone says the code has expired or has already been used, and nothing more

#### Scenario: The code runs out

- **WHEN** the code is opened more than 15 minutes after it was made
- **THEN** the phone says it has expired or has already been used, and no photo can be added

#### Scenario: The line changed meanwhile

- **WHEN** the quote was sent, or the Shimano brake pads line was removed, before the photo arrives
- **THEN** the phone says the code has expired or has already been used, and the quote is not changed

### Requirement: The phone page shows only what the photo needs

The phone page SHALL show the shop's name, the job's reference, the bike, the line and its reason, and SHALL NOT show the customer's name, phone or anything else about them.

#### Scenario: What the phone shows

- **WHEN** Alex's phone opens the code for the pads line
- **THEN** it shows North Street Cycles, "Add a photo for Shimano brake pads", "WH-1042 · Trek Domane AL 3" and "Rear pads worn — replacing", and not Maya Patel's name or phone

### Requirement: The computer shows the photo arriving by itself

While "Add a photo from your phone" is open, it SHALL show "Waiting for the photo…" and, once the photo has arrived, SHALL change by itself to "Photo added" with the photo, and the line SHALL read "1 photo — view or add for [line]".

#### Scenario: The pop-up updates

- **WHEN** Alex's phone adds the photo while the pop-up is open on the computer
- **THEN** within a few seconds the pop-up says "Photo added", and after Done the line reads "1 photo — view or add for Shimano brake pads"
