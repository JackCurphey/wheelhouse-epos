## ADDED Requirements

### Requirement: The shop writes its own checklists in Settings
Settings › Workshop SHALL have a Checklists section, under Services, listing each checklist with its number of items and the services that use it (`set-workshop-checklists`; Jack, 22 Oct). The Owner SHALL be able to add one, blank or from the full service template, change its name and items, and remove it (`set-workshop-checklist-edit`). A checklist SHALL have a name and 1 to 50 items. Only the Owner SHALL change them, as other Settings.

#### Scenario: Starting from the template
- **WHEN** a shop with no checklists presses Use the full service template
- **THEN** it has a "Full service checklist" of ten items, from Frame & fork to Bolts torqued, used for no service yet

#### Scenario: Staff can't change them
- **WHEN** someone who isn't the Owner tries to change a checklist
- **THEN** it is refused, as other Settings are

### Requirement: The Owner chooses which services have each checklist
Each checklist SHALL have a "Used for" choice of the shop's services. A service SHALL have one checklist at most: choosing it for another checklist moves it there.

#### Scenario: A service moves to another checklist
- **WHEN** Standard service uses the Full service checklist and the Owner chooses it for a Safety checklist
- **THEN** Standard service uses the Safety checklist, and the Full service checklist no longer lists it
