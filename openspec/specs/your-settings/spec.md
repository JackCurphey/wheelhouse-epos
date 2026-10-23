# your-settings Specification

## Purpose
TBD - created by archiving change your-settings-accessibility. Update Purpose after archive.

## Requirements

### Requirement: Each person's own accessibility settings

Your settings SHALL show the signed-in person's accessibility switches, each
off until they turn it on, and SHALL save each change at once to their own
login, so it follows them to any device and changes nothing for anyone else.

#### Scenario: a switch saved for this person only
- **WHEN** Jo turns on Reduce motion
- **THEN** it is saved for Jo's login, and Jack's settings are unchanged

#### Scenario: only known switches, on or off
- **WHEN** a change names a switch that doesn't exist, or a value that isn't on or off
- **THEN** it is refused and nothing is saved

### Requirement: Reduce motion

With Reduce motion on, the staff app SHALL run no animations or transitions,
as when the computer is set to reduce motion; the computer's setting turns it
on by itself.

#### Scenario: turned on
- **WHEN** the person turns Reduce motion on
- **THEN** animations stop straight away, and the diary's hover card opens at once

### Requirement: Show status symbols

With Show status symbols on, the diary's week blocks, its requests and the
legend's swatches SHALL each carry their status's shape as well as its colour;
with it off, status SHALL be colour alone, as before. The shape SHALL be
hidden from screen readers, which hear the status word.

#### Scenario: turned on
- **WHEN** the person turns Show status symbols on and opens the diary's week
- **THEN** each block shows its status's shape in its top-right corner, and the legend shows the same shapes

#### Scenario: off
- **WHEN** the switch is off
- **THEN** no block or swatch carries a shape
