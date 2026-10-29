## ADDED Requirements

### Requirement: Setting up a workshop computer warns about staying signed in to Google
With "A workshop computer" chosen, Set up this till SHALL show "Don’t stay signed in to Google on this computer: anyone using it could sign in as you." before the button (`till-setup-workshop`; 29 Oct answer 6). It SHALL NOT show for a till.

#### Scenario: A workshop computer chosen
- **WHEN** Jack Lewis chooses "A workshop computer" on Set up this till
- **THEN** the line about not staying signed in to Google shows above "Make this computer a workshop computer"

#### Scenario: A till chosen
- **WHEN** "A till" is chosen
- **THEN** the line isn't there
