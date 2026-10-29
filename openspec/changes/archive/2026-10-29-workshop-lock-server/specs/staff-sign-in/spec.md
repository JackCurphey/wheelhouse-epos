## ADDED Requirements

### Requirement: The workshop computer's Owner lock is held on the server
A signed-in session used on a workshop computer SHALL be recorded on the server as that workshop computer's, from its setup or its first request there. Such a session SHALL count as the Owner only while the Owner is checked in by PIN on that workshop computer, whatever cookies the browser sends, until the session ends by signing out.

#### Scenario: The workshop computer's cookie is deleted
- **WHEN** the workshop computer is signed in as Jack Lewis, nobody is working, and its workshop cookie is deleted from the browser
- **THEN** Owner-only pages and routes are still refused

#### Scenario: A till's key added
- **WHEN** the same browser sends a till's key instead
- **THEN** Owner-only pages and routes are still refused

#### Scenario: Jack Lewis is working
- **WHEN** Jack Lewis types his own PIN on the workshop computer
- **THEN** his Owner pages are there, as before

#### Scenario: Signing out
- **WHEN** Jack Lewis signs out on that browser and signs in again on a browser that is not a workshop computer
- **THEN** his Owner pages are there

### Requirement: A workshop computer's sign-in keeps its own PIN and settings locked
On a workshop computer, the sign-in's own PIN and settings SHALL be changed only while that sign-in's own team member is checked in by PIN on that workshop computer, held on the server as the Owner's pages are, for staff sign-ins as well as the Owner's.

#### Scenario: The cookie deleted
- **WHEN** the workshop computer's cookie is deleted and someone asks for a new PIN for the sign-in
- **THEN** it is refused

### Requirement: A workshop computer keeps no remembered WorkOS session
When a WorkOS sign-in becomes a workshop computer's, its WorkOS session SHALL be ended at WorkOS, and the Wheelhouse sign-in SHALL stay signed in, so that signing in again at that computer needs the person's own WorkOS sign-in.

#### Scenario: Set up from a WorkOS sign-in
- **WHEN** Jack Lewis, signed in through WorkOS, makes a computer a workshop computer
- **THEN** his WorkOS session is ended and the workshop computer stays signed in
