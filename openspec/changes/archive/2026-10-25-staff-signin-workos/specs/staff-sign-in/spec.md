# Spec Delta

## ADDED Requirements

### Requirement: Staff sign in on WorkOS's page
When a staff sign-in service is connected, a person SHALL be able to start signing in from Wheelhouse, sign in on WorkOS's page, and come back to Wheelhouse signed in to their shop. They SHALL be signed in only if WorkOS has checked their email and it belongs to an active person on a shop's staff list. The session SHALL last as staff sessions do today (30 days).

#### Scenario: an owner signs in
- **WHEN** the owner of North Street Cycles signs in on WorkOS's page with the email North Street Cycles has for them
- **THEN** they are back in Wheelhouse, signed in to North Street Cycles

#### Scenario: an email no shop has
- **WHEN** someone signs in on WorkOS's page with an email that isn't on any shop's staff list
- **THEN** they are not signed in to Wheelhouse, and are told that email isn't on a staff list

#### Scenario: someone taken off the staff list
- **WHEN** a person whose login has been turned off signs in on WorkOS's page
- **THEN** they are not signed in to Wheelhouse

#### Scenario: an email WorkOS hasn't checked
- **WHEN** WorkOS sends someone back without having checked their email
- **THEN** they are not signed in to Wheelhouse

#### Scenario: a return that didn't start here
- **WHEN** a link back from WorkOS arrives that this browser didn't start
- **THEN** nobody is signed in

### Requirement: A WorkOS account is linked the first time
The first time a person signs in through WorkOS, their WorkOS account SHALL be linked to their place on the staff list. Later sign-ins SHALL use that link, even if they change their email in WorkOS.

#### Scenario: a changed email
- **WHEN** a person who has signed in through WorkOS before changes their email in WorkOS and signs in again
- **THEN** they are signed in to the same shop as before

### Requirement: Signing out ends the WorkOS sign-in too
Signing out of a session that began on WorkOS's page SHALL end it in Wheelhouse and at WorkOS, so the next person at that computer has to sign in again, not just press Continue.

#### Scenario: signing out at a shared computer
- **WHEN** a person who signed in through WorkOS signs out
- **THEN** their Wheelhouse session ends and they are taken through WorkOS's sign-out, back to Wheelhouse

### Requirement: Staff sign in only through WorkOS
Staff SHALL sign in only on WorkOS's page. Signing in to Wheelhouse with an email and password directly SHALL be refused, saying staff sign in through WorkOS. "Sign in" in the staff app SHALL go to WorkOS's page.

#### Scenario: the old password box
- **WHEN** someone sends a staff email and password straight to Wheelhouse's sign-in
- **THEN** they are not signed in, and are told staff sign in through WorkOS

#### Scenario: not switched on
- **WHEN** no staff sign-in service is connected and someone starts signing in
- **THEN** they are told signing in isn't switched on yet

### Requirement: The test copy never uses a live sign-in key
The hosted test copy of Wheelhouse SHALL refuse to start if it is given a live WorkOS key.

#### Scenario: a live key on the test copy
- **WHEN** the hosted test copy starts with a live WorkOS key in its settings
- **THEN** it refuses to start and names the setting to remove
