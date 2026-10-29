# Spec Delta

## ADDED Requirements

### Requirement: The Working pills at the bottom of every workshop page
On a workshop computer with trust PIN on, while someone is working, every staff page SHALL end in a strip reading "Working:", with a pill for each person "Who’s working?" would offer and for the person working, highlighted, then "Someone else" (`workshop-working-pills`; roles and switches 9). It SHALL take the place of "Working: [name] · Switch". With trust PIN off, the Working bar SHALL stay.

#### Scenario: Alex is working
- **WHEN** trust PIN is on, Alex Morgan and Jo Taylor typed their PINs on the workshop computer today, and Alex is working on the diary
- **THEN** the bottom of the page shows "Working:" with Alex Morgan highlighted, Jo Taylor and "Someone else", and there is no Switch at the top

#### Scenario: Trust PIN off
- **WHEN** trust PIN is off and Alex Morgan is working
- **THEN** the page shows "Working: Alex Morgan · Switch" at the top and no pills

### Requirement: A pill swaps who is working on the same page
Tapping a pill SHALL make that person the one working without leaving the page, under the same rules as tapping a name on "Who's working?". "Someone else" SHALL end the check-in and show the PIN pad.

#### Scenario: Jo takes over
- **WHEN** Alex Morgan is working on the diary and Jo Taylor taps her pill
- **THEN** Jo Taylor is working, on the diary, and Alex's check-in has ended

#### Scenario: Someone else
- **WHEN** someone taps "Someone else"
- **THEN** nobody is working and Enter your PIN shows with the pad

#### Scenario: A pill the server refuses
- **WHEN** a pill is tapped for someone the server won't check in by a tap
- **THEN** it is refused, the person working stays, and the reason shows
