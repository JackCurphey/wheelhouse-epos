## ADDED Requirements

### Requirement: Settings › Messages lists the shop's own messages

Settings › Messages SHALL show "Your own messages" under the automatic messages, each with its name, when it goes and how, Edit, and On or Off, followed by "+ Add your own message".

#### Scenario: a spring check
- **WHEN** the shop has "Spring check", 6 months after a job is collected, by email
- **THEN** its row reads "Spring check" and "6 months after a job is collected · by email", with Edit and On

### Requirement: The Owner adds and changes them in the drawn box

"+ Add your own message" SHALL open the box drawn as `set-msg-new`: Name, "Send it", "How long after" (or "before") with Days or Months, "Send by" Text and Email, the Wording with its put-in buttons, the drawn note, Cancel and "Add the message". Edit SHALL open the same box with Remove, Cancel and Save.

#### Scenario: something missing
- **WHEN** the Owner presses "Add the message" with no name
- **THEN** the box stays open and says "Give the message a name."

#### Scenario: removing one
- **WHEN** the Owner opens Edit on a message and presses Remove
- **THEN** its row goes
