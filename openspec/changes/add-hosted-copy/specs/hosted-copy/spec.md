# Spec Delta

## Purpose

The hosted copy is the copy of Wheelhouse on the internet that Jack tries
each merge on, from any device. It holds test data only, never sends real
texts or takes real money, and can be brought back if it breaks.

## ADDED Requirements

### Requirement: The hosted copy opens on any device over HTTPS
The hosted copy SHALL be reachable at one fixed web address over HTTPS, from a phone, tablet or computer, without anything installed.

#### Scenario: Opening it on a phone
- **WHEN** Jack opens the hosted copy's address on his phone
- **THEN** he sees the Wheelhouse sign-in page over HTTPS

#### Scenario: Plain http
- **WHEN** someone opens the address with `http://`
- **THEN** they are sent to the `https://` address

### Requirement: Jack signs in with his own test login
Jack SHALL have a test login on the hosted copy's test shop. The address and his login SHALL be given to him privately and never written in the repo.

#### Scenario: Signing in
- **WHEN** Jack signs in on the hosted copy with his test login
- **THEN** he sees the same app as on `localhost:8080`, with the test shop's data

### Requirement: Every merge to main goes onto the hosted copy
Each merge to `main` SHALL be put on the hosted copy automatically, once the tests have passed on that commit. Only `main` SHALL ever be deployed: never a branch, a pull request, or a commit whose tests failed.

#### Scenario: A merge
- **WHEN** a pull request merges to `main` and the tests pass on that commit
- **THEN** within [n] minutes the hosted copy runs that commit

#### Scenario: Tests fail on main
- **WHEN** the tests fail on a commit on `main`
- **THEN** that commit is not deployed and the hosted copy keeps running the one before

#### Scenario: A branch or pull request
- **WHEN** someone pushes to a branch that is not `main`, or opens a pull request
- **THEN** nothing is deployed

### Requirement: The hosted copy shows which commit it runs
The hosted copy's health check SHALL report the commit it is running.

#### Scenario: Checking the version
- **WHEN** someone asks the hosted copy's health check what it runs
- **THEN** it answers with the commit of the last successful deploy

### Requirement: A failed update is reported and never leaves the copy broken for long
An update SHALL apply its database changes (migrations) and pass its health check before it is counted as deployed. If either fails, the deploy SHALL be reported as failed to Mark, and the hosted copy SHALL either still be running the version before or be back on it within [n] minutes.

#### Scenario: A migration fails
- **WHEN** an update's migration fails on the hosted copy
- **THEN** the deploy is reported as failed to Mark, and within [n] minutes the hosted copy runs the version before

#### Scenario: A health check fails
- **WHEN** the new version cannot reach the database after it starts
- **THEN** the deploy is reported as failed, and within [n] minutes the hosted copy runs the version before

### Requirement: A bad update can be undone
There SHALL be a written way back from a bad update that did deploy. Going back to the previous version SHALL take no more than [n] minutes. When the bad update changed the database, the database SHALL go back to how it was just before that update. Anything done on the hosted copy after that moment is lost.

#### Scenario: A bad update with no database change
- **WHEN** a deployed update breaks a screen and changed no database tables
- **THEN** Mark puts the previous version back, following the written steps, within [n] minutes, and no test data is lost

#### Scenario: A bad update with a database change
- **WHEN** a deployed update with a new migration breaks the app
- **THEN** the previous version comes back with the database as it was just before the update, the time it took is written down, and Jack is told that anything made after the update is gone

### Requirement: A save is only reported once it is really saved, and shops never mix
The hosted copy SHALL connect to its database in a way where the app only reports a save once the data is stored, and one shop's request can never use a connection still set to another shop. That means the database's direct address, never a transaction-mode pooler, with tenancy scoped per session.

#### Scenario: The address used
- **WHEN** the hosted copy is set up
- **THEN** its database setting is the database's direct address, and the setup notes record which address it is and why

#### Scenario: Per-transaction tenancy switched on
- **WHEN** the hosted copy starts with tenancy set to per-transaction
- **THEN** the server refuses to start, before any migration runs, naming the setting

#### Scenario: A transaction-mode pooler is caught
- **WHEN** the server's start-up check finds evidence that two requests share one database connection
- **THEN** the server refuses to start, saying the database connection is unsafe

### Requirement: The hosted copy doesn't keep uploads, and says so
Uploaded files on the hosted copy (job attachments and uploaded images) SHALL NOT be backed up, and MAY be lost on any deploy. Jack SHALL be told this before he first uses it.

#### Scenario: An attachment after a deploy
- **WHEN** a photo is attached to a job and the next merge is deployed
- **THEN** the photo is gone, as Jack was told it would be

### Requirement: The hosted copy holds test data only
The hosted copy SHALL hold only test data: a test shop loaded from the drawings' example data, and anything made while trying it. Real shop data, real customers and real Citrus Lime export files SHALL never be loaded onto it. Where the drawings give no value, the test shop SHALL use a bracketed placeholder.

#### Scenario: Loading the test shop
- **WHEN** the test shop is loaded onto an empty hosted copy
- **THEN** its names, prices and wording match the drawings, and gaps read as placeholders like `[n]`

#### Scenario: Loading it twice
- **WHEN** the test shop is loaded onto a hosted copy that already has it
- **THEN** it is refused, and nothing is duplicated or changed

### Requirement: The hosted copy never sends a real text
The hosted copy SHALL never send a text message to anyone. If it is given texting keys, the server SHALL refuse to start. Wherever the app would send a text, the text SHALL not go, and the app SHALL say it wasn't sent, as it does today with no keys.

#### Scenario: Sending a quote link
- **WHEN** staff send a quote on the hosted copy to a customer with a phone number
- **THEN** no text is sent and the app says texts aren't set up

#### Scenario: Texting a customer
- **WHEN** staff write a text to a customer on the hosted copy
- **THEN** no text is sent and the message is kept as not sent, with the reason

#### Scenario: Texting keys given by mistake
- **WHEN** the hosted copy starts with texting keys in its settings
- **THEN** the server refuses to start, naming the setting to remove

### Requirement: The hosted copy never connects to a real online shop
The hosted copy SHALL refuse to connect a Shopify store, so it never changes a real online shop's stock or products.

#### Scenario: Connecting Shopify
- **WHEN** staff try to connect a Shopify store on the hosted copy
- **THEN** it is refused with "This is a test copy of Wheelhouse: connecting Shopify is switched off." and nothing is saved

### Requirement: The hosted copy never takes real money
The hosted copy SHALL take no real payment. Every outside service added later (payments, email, sign-in, accounts software, Lightspeed) SHALL run its pretend version there, and the server SHALL refuse to start if given a real key for one. Each service's own change SHALL add its key names to that check, with a test.

#### Scenario: A real payment key given by mistake
- **WHEN** a payment service has been added, and the hosted copy starts with that service's real key in its settings
- **THEN** the server refuses to start, naming the setting to remove

### Requirement: Strangers cannot make an account
New shop accounts SHALL only be made on the hosted copy with the private sign-up code. Without the code, sign-up SHALL be refused.

#### Scenario: Sign-up without the code
- **WHEN** someone who found the address tries to sign up without the code
- **THEN** it is refused, and no shop or login is made

### Requirement: The hosted copy always uses the real time
The hosted copy SHALL always use the real date and time. A pinned test clock SHALL have no effect on it.

#### Scenario: A test clock left in the settings
- **WHEN** the hosted copy starts with a test clock set to 1 Sep 2026
- **THEN** it still shows today's real date in the shop's time zone

### Requirement: The database is backed up
The database SHALL be backed up so it can be brought back to any moment in the last [n] days.

#### Scenario: Something deleted by mistake
- **WHEN** test data is deleted by mistake at a known time
- **THEN** the database can be brought back to just before that time

### Requirement: A timed restore is rehearsed before any real use
Before any real shop uses Wheelhouse, Jack SHALL restore the database (and the attachments, once uploads are kept) from backup into a fresh copy, with Mark watching (PL-3, Jack's hands, Mark's eyes), and check it by opening a job. A dated runbook SHALL record each step and how long it took. Until then the rehearsal SHALL read "blocked", never "done". It SHALL be repeated whenever the host or backup method changes.

#### Scenario: The rehearsal
- **WHEN** Jack, with Mark watching, restores the database to a chosen moment into a fresh copy
- **THEN** a job opens there as it was at that moment, and the runbook gives the date, each step and how long it took

#### Scenario: Real use before a rehearsal
- **WHEN** someone proposes real shop use and there is no dated restore runbook
- **THEN** the rehearsal reads "blocked", and real use waits until it is done and written down
