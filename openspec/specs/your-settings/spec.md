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

### Requirement: Folded sidebar

On a computer the Till SHALL show the icon rail instead of the full sidebar,
and with the person's Folded sidebar switch on every page SHALL. The rail's
Unfold SHALL open the full sidebar over the page, and Fold or Escape SHALL
close it; resting the pointer on the rail SHALL NOT open it (Jack, 24 Oct).

#### Scenario: the Till
- **WHEN** someone opens the Till on a computer
- **THEN** the icon rail shows, and pressing Unfold opens the full sidebar over the till

#### Scenario: resting the pointer
- **WHEN** the pointer rests on the folded rail
- **THEN** the rail stays folded until Unfold is pressed

#### Scenario: switched on
- **WHEN** the person turns Folded sidebar on
- **THEN** every page on a computer shows the icon rail straight away

### Requirement: Larger text

Your settings SHALL have the drawn "Larger text" switch, "Makes text across
Wheelhouse a step larger.", with a preview of Normal and Larger. On, every text
in the staff app SHALL be a step larger (14 to 17, the same step for every
size), straight away and on every page, without zooming: layouts, dragging and
pop-ups stay as they are. It is the person's own setting, kept with their
other switches.

#### Scenario: Switched on
- **WHEN** Jo switches Larger text on
- **THEN** text that was 14 is 17 and text that was 15 is about 18, on every page, and the diary's blocks stay where they were

#### Scenario: Off by default
- **WHEN** someone hasn't switched it on
- **THEN** text is the size it always was

### Requirement: Don't close things by themselves

Your settings SHALL have the drawn "Don’t close things by themselves" switch,
"Things that close or send after a few seconds — the till’s receipt choice,
Undo — wait until you press a key or button.", between Reduce motion and Larger
text. It is the person's own setting, off by default.

#### Scenario: Switched on
- **WHEN** Jo switches Don't close things by themselves on
- **THEN** it is saved with her other switches, and Bike ready and the till's Paid box wait for her

### Requirement: Each person can switch off the diary's legend

Your settings › Accessibility SHALL have "Show the diary legend" as its first switch, on to start, saved for that person only. It SHALL not be offered on a phone.

#### Scenario: switching it off
- **WHEN** Jo switches off "Show the diary legend"
- **THEN** it saves at once, the diary shows no legend for Jo, and nobody else's diary changes
