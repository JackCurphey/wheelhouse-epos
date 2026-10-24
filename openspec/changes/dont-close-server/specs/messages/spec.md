## ADDED Requirements

### Requirement: Bike ready waits for Send now when Don't close things by themselves is on

When the person marking a job ready has "Don't close things by themselves" on,
Bike ready SHALL be held, not sent after a minute: it SHALL wait until Send now
sends it or Undo stops it, however long that takes. Send now SHALL send only a
held message.

#### Scenario: Held, then sent
- **WHEN** Jo, with the switch on, marks Maya's job ready and later presses Send now
- **THEN** Bike ready waits with no send time until then, and goes as soon as she presses it

#### Scenario: Held, then undone
- **WHEN** Jo presses Undo instead
- **THEN** Bike ready is never sent

#### Scenario: Switch off
- **WHEN** someone with the switch off marks a job ready
- **THEN** Bike ready goes after its minute, as before
