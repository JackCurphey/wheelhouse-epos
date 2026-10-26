## ADDED Requirements

### Requirement: A signed-in customer adds a bike from their account

The account SHALL have "+ Add a bike", also on the empty bikes card, opening "Add a bike" with "Make and model" and "Colour, or anything that helps us spot it", Cancel and Add bike. The bike SHALL show at once. The add-bike route SHALL refuse a request from another website.

#### Scenario: adding a bike
- **WHEN** Maya adds "Brompton C Line" in "Black"
- **THEN** "Brompton C Line · Black" is listed under Your bikes

#### Scenario: from another website
- **WHEN** another website posts to the add-bike route with Maya's sign-in
- **THEN** it is refused, and no bike is added

### Requirement: A repair opened from the account leads back to it

A repair opened from the account SHALL show "Your account", leading back to the account, and SHALL NOT offer a link to keep.

#### Scenario: opened from the account
- **WHEN** Maya opens her repair from her account
- **THEN** there's no "Keep this link" or Copy link, and "Your account" leads back
