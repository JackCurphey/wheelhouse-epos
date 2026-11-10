# Spec Delta

Follows Jack's answer 2 of 9 Nov (`docs/decisions/2026-11-09-account-answers.md`).

## ADDED Requirements

### Requirement: A shop adds its own privacy notice
Settings › Shop details SHALL have "Privacy notice", with "Add your privacy notice" opening a box for the shop's own words and Save, then Change and Remove once added, and the line "Shown on your website account. Each shop is responsible for its own policies." Wheelhouse SHALL NOT offer wording of its own. Only the Owner SHALL change it.

#### Scenario: adding it
- **WHEN** the Owner pastes the shop's privacy notice and saves
- **THEN** it is kept, and the website account shows "Privacy notice"

#### Scenario: removing it
- **WHEN** the Owner removes it
- **THEN** the website account no longer shows "Privacy notice"

#### Scenario: not the Owner
- **WHEN** a member of staff who isn't the Owner opens Shop details
- **THEN** they can't change the privacy notice
