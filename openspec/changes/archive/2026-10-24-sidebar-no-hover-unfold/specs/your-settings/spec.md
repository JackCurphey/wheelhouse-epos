## MODIFIED Requirements

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
