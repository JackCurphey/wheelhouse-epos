## ADDED Requirements

### Requirement: Each person's own accessibility settings

Your settings SHALL show the signed-in person's accessibility switches, each
off until they turn it on, and SHALL save each change at once to their own
login, so it follows them to any device and changes nothing for anyone else.

#### Scenario: a switch saved for this person only
- **WHEN** Jo turns on Larger text
- **THEN** it is saved for Jo's login, and Jack's settings are unchanged

#### Scenario: only known switches, on or off
- **WHEN** a change names a switch that doesn't exist, or a value that isn't on or off
- **THEN** it is refused and nothing is saved

### Requirement: Larger text

With Larger text on, the staff app's text SHALL be a step larger everywhere
(the drawing's 14 to 17), without the page becoming wider than the screen.

#### Scenario: turned on
- **WHEN** the person turns Larger text on
- **THEN** the app's text is larger straight away, with no Save

### Requirement: Reduce motion

With Reduce motion on, the staff app SHALL run no animations or transitions,
as when the computer is set to reduce motion; the computer's setting turns it
on by itself.

#### Scenario: turned on
- **WHEN** the person turns Reduce motion on
- **THEN** animations stop straight away, and the diary's hover card opens at once
