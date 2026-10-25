# staff-sign-in Specification

## Purpose
How staff sign in to Wheelhouse and sign out again: only on WorkOS's own page (signing-in decision 2; WorkOS only, Jack 25 Oct), with Wheelhouse keeping its own 30-day session.

## Requirements

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

### Requirement: After signing out, the drawn "You've signed out" page
After a person signs out of the staff app, including through WorkOS's sign-out, they SHALL see "You've signed out", "Close this window, or sign in again." and a "Sign in again" button that goes to WorkOS's sign-in page.

#### Scenario: Jo signs out at the workshop computer
- **WHEN** Jo presses Sign out
- **THEN** she sees "You've signed out" with "Sign in again"

### Requirement: A session that has run out says so, and comes back to the same page
When a person's session has run out, the staff app SHALL show "Please sign in again" with "You were signed out after a while without activity. Sign in and you'll be back where you were." Its "Sign in again" SHALL go to WorkOS's sign-in page, and after signing in they SHALL be back on the staff app page they were on. Only staff app pages SHALL be returned to.

#### Scenario: back to the diary
- **WHEN** Alex's session has run out while he was on the diary, and he presses "Sign in again" and signs in
- **THEN** he is back on the diary

#### Scenario: a return address that isn't the staff app
- **WHEN** a sign-in is started with somewhere outside the staff app as the page to return to
- **THEN** after signing in the person lands on the staff app's front page instead

### Requirement: A failed sign-in says what went wrong
When signing in through WorkOS fails, the staff app SHALL say why, in plain words: the email isn't on a shop's staff list, WorkOS hasn't checked the email yet, too many tries, signing in isn't switched on, or the sign-in didn't work. Each SHALL offer a way to go on, except "not switched on", which has none.

#### Scenario: an email no shop has
- **WHEN** someone signs in on WorkOS's page with an email no shop has on its staff list
- **THEN** the staff app says that email isn't on a shop's staff list, and offers "Sign in again"

### Requirement: Opening the staff app signed out goes straight to sign-in
Opening any staff app page while not signed in, with no session that has run out and no message to show, SHALL show Wheelhouse's own sign-in screen, "Sign in to Wheelhouse", with "Continue with Google" and "Sign in with email". After signing in either way, the person SHALL be on the page they opened.

#### Scenario: a bookmark to the diary
- **WHEN** someone not signed in opens a bookmark to the diary
- **THEN** they see "Sign in to Wheelhouse", and after signing in they are on the diary

### Requirement: Continue with Google goes straight to Google
"Continue with Google" on Wheelhouse's sign-in screen SHALL go straight to Google's account chooser, without WorkOS's sign-in page in between. "Sign in with email" SHALL go to WorkOS's page for email and password. Either way, the same staff-list and checked-email rules decide who is let in.

#### Scenario: Jo signs in with Google
- **WHEN** Jo presses "Continue with Google" and chooses her Google account, whose email North Street Cycles has for her
- **THEN** she is back in Wheelhouse, signed in to North Street Cycles, without having seen WorkOS's page

### Requirement: Sign in again leads to Wheelhouse's sign-in screen
"Sign in again" on "You've signed out" and "Please sign in again", and the button on a failed sign-in's message, SHALL lead to Wheelhouse's sign-in screen. From "Please sign in again", the person SHALL still come back to the page they were on.

#### Scenario: after signing out
- **WHEN** Jo presses "Sign in again" on "You've signed out"
- **THEN** she sees "Sign in to Wheelhouse"
