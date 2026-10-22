## ADDED Requirements

### Requirement: The shop keeps its own storage slots
Settings › Workshop SHALL have a Storage slots section: a switch, off to start, with the note "On for this shop. Staff can note where a bike is kept, and the diary block shows the slot where there’s room.", the shop's slots as chips each with Remove, and "+ Add a slot" (`set-workshop-diary`; Workshop day 27). A slot's name SHALL be 1 to 40 letters and not used twice. Only the Owner SHALL change them.

#### Scenario: Adding a hook
- **WHEN** the Owner switches Storage slots on and adds "Hook 1"
- **THEN** Hook 1 is a chip in the list, and the section's summary reads "On · 1 slot"

#### Scenario: Removing a slot in use
- **WHEN** the Owner removes Hook 3 while a bike is kept on it
- **THEN** Hook 3 goes, and that bike is no longer shown on a slot
