# Spec Delta

## ADDED Requirements

### Requirement: The sign-in screens
The shop's sign-in page SHALL ask for an email ("Sign in to your account", "Email me a code"), then for the six-digit code ("Enter your code") in one box drawn as six that checks itself on the sixth digit, with "Send a new code" and "Use a different email". A wrong or expired code SHALL say so under the boxes. Once signed in, the page the sign-in link came from SHALL open when it is one of this shop's own pages, and the shop's booking page otherwise.

#### Scenario: Maya signs in from her booking
- **WHEN** Maya opens sign-in from her booking, asks for a code and types it
- **THEN** she is signed in and back on her booking

#### Scenario: an expired code
- **WHEN** the code she types has expired
- **THEN** "That code has expired — send a new one" shows under the boxes, and Send a new code stands out

#### Scenario: a link to somewhere else
- **WHEN** the sign-in link's page is another site or another shop's
- **THEN** after the code the shop's own booking page opens instead
