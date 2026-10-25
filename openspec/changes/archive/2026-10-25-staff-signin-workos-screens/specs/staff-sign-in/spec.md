# Spec Delta

## ADDED Requirements

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
Opening any staff app page while not signed in, with no session that has run out and no message to show, SHALL go straight to WorkOS's sign-in page. After signing in, the person SHALL be on the page they opened.

#### Scenario: a bookmark to the diary
- **WHEN** someone not signed in opens a bookmark to the diary
- **THEN** they are taken to WorkOS's sign-in page, and after signing in they are on the diary
