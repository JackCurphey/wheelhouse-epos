# Spec Delta

## ADDED Requirements

### Requirement: What's sent can't stop the server
The server SHALL refuse a request made of more small pieces of data than it could honestly need, before trying to read them, and SHALL go on answering every other request for every shop. A booking with real photos SHALL be taken at the largest size allowed, whatever is in its notes.

#### Scenario: A request built to run the server out of memory
- **WHEN** someone with no sign-in sends a booking about as large as allowed, made of many thousands of tiny empty values
- **THEN** they are told "That's too much to send in one go." and the connection closes, and everyone else, at every shop, is answered as normal

#### Scenario: Far too much for a small request
- **WHEN** someone with no sign-in sends over 100 KB to sign up or sign in
- **THEN** they are told "That's too much to send in one go." and the connection closes

#### Scenario: The largest honest booking
- **WHEN** Maya books with 5 photos of 10 MB each
- **THEN** her booking is taken as normal
