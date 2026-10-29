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

### Requirement: A signed-in request is looked up once
The server SHALL look up who is signed in once per staff request, before it takes that request's database connection, and every later "who is signed in?" check in the same request (such as the Owner-only check) SHALL use that answer without taking a second connection.

#### Scenario: an owner saves settings on several screens at once
- **WHEN** a shop's owner sends 12 Owner-only requests at the same moment
- **THEN** every one is answered (not refused for being busy) well within the 5-second wait for a connection

#### Scenario: a staff member is still refused
- **WHEN** a signed-in staff member who is not the Owner sends an Owner-only request
- **THEN** it is refused as before, with the same answer

### Requirement: One request that can't be looked up never stops the server
When the server can't look up who is signed in on a staff request (the database is too busy to answer in time, or refuses the sign-in cookie), it SHALL answer that request with "Internal server error", without the database's own words, and SHALL go on answering every other request, for every shop.

#### Scenario: a sign-in cookie the database refuses
- **WHEN** a staff request arrives with a sign-in cookie the database can't look up
- **THEN** that request gets "Internal server error"
- **AND** the next request, from anyone, is answered as normal

### Requirement: Another app's cookie never stops a signed-in request
A cookie the server can't read (such as `promo=50%off`, set by another app on the same domain) SHALL be kept as it is, and SHALL NOT stop a request that is otherwise signed in.

#### Scenario: a signed-in owner with another app's cookie
- **WHEN** the Owner, signed in, opens a screen while their browser also carries `promo=50%off`
- **THEN** the screen is answered as normal

### Requirement: Continue with Google carries Google's official G
"Continue with Google" SHALL show Google's official G from Google's Sign in with Google branding kit, unchanged in shape and colour, at 20 by 20 beside the words, and hidden from screen readers. It SHALL NOT show a stand-in.

#### Scenario: Jo opens the sign-in screen
- **WHEN** Jo opens Wheelhouse's sign-in screen
- **THEN** "Continue with Google" shows Google's full-colour G before the words

### Requirement: Wheelhouse picks each person's till PIN
A person's till PIN SHALL be four digits picked at random by Wheelhouse, which nobody else at the shop has; nobody chooses their own, so choosing can't reveal a colleague's (signing in 4 and 7; `pin-change`). "Give me a different one" SHALL show another. "Keep this PIN" SHALL keep only the PIN shown, within 15 minutes of showing it, and SHALL refuse it if someone else kept it meanwhile. Keeping a new PIN SHALL stop the old one working.

#### Scenario: A new PIN
- **WHEN** Jo Taylor asks for a new PIN and keeps the one shown
- **THEN** that PIN checks her in, and her old one doesn't

#### Scenario: No choosing
- **WHEN** someone tries to keep a PIN Wheelhouse didn't show them
- **THEN** it is refused

### Requirement: Nobody types a PIN, and asking for others is limited
Nobody SHALL type a PIN for someone else (Jack, 28 Oct, answer 2). "Give me a different one" SHALL be limited to 10 PINs a sign-in in 10 minutes, after which it says "Wait a moment, then try again".

#### Scenario: Pressing it over and over
- **WHEN** Jo Taylor asks for an eleventh PIN within 10 minutes
- **THEN** she is told to wait a moment

### Requirement: PINs are never kept in plain text
The server SHALL keep only a slow, salted hash of each PIN and of each PIN offered, and SHALL never write a PIN to its log.

#### Scenario: Looking in the database
- **WHEN** someone reads a person's row
- **THEN** they see a hash, not the PIN

### Requirement: The Owner clears a forgotten PIN
The Owner SHALL be able to clear someone else's till PIN, so they can't check in until they get a new one, and they stop serving on any till that day (signing in 6; roles and switches 5: nobody clears their own). Until roles, only the Owner SHALL clear a PIN.

#### Scenario: Jo forgot her PIN
- **WHEN** Jack Lewis clears Jo Taylor's PIN
- **THEN** her old PIN no longer checks her in

### Requirement: Check in at the till with your PIN alone
The till SHALL ask "Enter your PIN" when nobody is serving on it, and the PIN alone SHALL say who is checking in: no name first (signing in 4; `till-checkin`). The fourth digit SHALL be checked at once, with no OK button. The person checked in SHALL be serving until they switch, someone else checks in on that till, or the shop's day ends.

#### Scenario: Jo checks in
- **WHEN** Jo Taylor types her four digits on the till
- **THEN** the till shows "Serving: Jo Taylor" and her sales go under her name

#### Scenario: Taking over
- **WHEN** Alex Morgan types his PIN on the till Jo Taylor is serving on
- **THEN** Alex Morgan is serving

### Requirement: A wrong PIN says so, with no lock
A PIN nobody has SHALL clear the dots and say "That PIN isn’t anyone’s — try again", and SHALL never lock the till (signing in 8 and 9; `till-pin-wrong`). After 10 tries in 10 minutes at one shop, each further try SHALL wait 3 seconds, one at a time per till, so a PIN can't be found by trying them all quickly and one till's guessing never holds up another (Jack, 28 Oct, answer 1).

#### Scenario: A slip of the finger
- **WHEN** Jo Taylor types a PIN nobody has
- **THEN** the dots clear and the till says "That PIN isn’t anyone’s — try again"

### Requirement: The PIN screen shows who's checked in today
The PIN screen SHALL list "Checked in today" with everyone who has checked in on this till that day (on a computer that isn't a set-up till, everyone who checked in on one that isn't), and say "No PIN yet? Sign in on your phone, or ask the owner or a manager to give you one here." (signing in 4; UX walk-through 4 H1; `till-checkin`).

#### Scenario: Second in
- **WHEN** Alex Morgan checked in on Till B1 this morning and Jo Taylor comes to Till B1
- **THEN** the PIN screen lists Alex Morgan under Checked in today

#### Scenario: Another till
- **WHEN** Alex Morgan checked in on Till B1 and Jo Taylor comes to Till B2
- **THEN** Till B2's PIN screen doesn't list Alex Morgan

### Requirement: A check-in belongs to its shop and its till
A check-in SHALL count only in its own shop, on the browser and sign-in it was made on, on the till or workshop computer it was made on, and only on the shop's day it was made. On a workshop computer it SHALL also stop counting 10 minutes after it was last used.

#### Scenario: Another shop
- **WHEN** a check-in made at one shop is sent to another
- **THEN** nobody is serving there

#### Scenario: The browser became a till
- **WHEN** Jo Taylor checked in on a browser and the Owner then makes it Till B1
- **THEN** nobody is serving on Till B1 until someone checks in there

#### Scenario: The workshop computer and the till
- **WHEN** Alex Morgan checks in on the workshop computer
- **THEN** he is not checked in on Till B1, and the workshop computer's check-in doesn't count on a browser that is neither

### Requirement: The Owner gives a PIN at the till
The Owner checked in at the till SHALL be able to give a till PIN to someone at the shop who has none, with the screen turned to them (UX walk-through 4 M2 and M3; Jack's answers 28 Oct, 3 to 5; `till-give-pin`). Wheelhouse SHALL pick the PIN as it does in Your settings: four digits nobody else at the shop has, "Give me a different one", and "Keep this PIN" keeping only the PIN shown, within 15 minutes. Keeping it SHALL take the till back to Enter your PIN. Until roles, only the Owner SHALL give a PIN; nobody SHALL give a PIN to themselves, and nobody SHALL give the Owner a PIN.

#### Scenario: A till-only person's first PIN
- **WHEN** Jack Lewis, checked in, gives [Name] their PIN and [Name] keeps it
- **THEN** the till goes back to Enter your PIN, and [Name]'s PIN checks them in

#### Scenario: Someone who isn't the Owner
- **WHEN** Jo Taylor is checked in and asks the server to give someone a PIN
- **THEN** it is refused

#### Scenario: Someone who already has a PIN
- **WHEN** the Owner asks to give a PIN to Alex Morgan, who has one
- **THEN** it is refused, and Alex Morgan's PIN still works

### Requirement: Serving opens a menu while someone has no PIN
For the Owner, and only while someone at the shop has no PIN, "Serving: [name]" SHALL open a menu with "Switch who’s serving" and the PIN to give (`till-serving-menu`, `till-serving-menu-several`). With one person it SHALL offer "Give [Name] their PIN"; with several, "Give someone their PIN" with "[n] people have no PIN yet", which opens "Who’s getting a PIN?" listing them (`till-give-pin-pick`). Otherwise Serving SHALL stay one tap back to Enter your PIN.

#### Scenario: Two people with no PIN
- **WHEN** Jo Taylor and [Name] have no PIN and Jack Lewis taps Serving
- **THEN** the menu offers "Give someone their PIN · 2 people have no PIN yet"

#### Scenario: Everyone has a PIN
- **WHEN** everyone at the shop has a PIN and Jack Lewis taps Serving
- **THEN** the till goes straight back to Enter your PIN

### Requirement: A first sign-in opens "Your till PIN" by itself
Someone on the team with no till PIN SHALL get "Your till PIN" by itself the first time they open Wheelhouse, over the page they land on: "Welcome to [shop], [first name]…", "Keep this PIN", "Give me a different one" and "Skip for now", with no ✕ (UX walk-through 4 H1; `pin-first`). Keeping or skipping SHALL leave them on that page and SHALL not ask again. The Owner's own sign-in SHALL not be asked.

#### Scenario: Jo's first sign-in
- **WHEN** Jo Taylor, just added to the team, signs in for the first time
- **THEN** "Your till PIN" opens with a PIN Wheelhouse picked, and Skip for now

#### Scenario: Skipped
- **WHEN** Jo pressed Skip for now and opens Wheelhouse again
- **THEN** it doesn't open, and Your settings still offers Get your PIN

### Requirement: After a PIN is cleared, the next sign-in gives a new one the same way
When the Owner clears someone's PIN, the next time that person opens Wheelhouse "Your till PIN" SHALL open by itself saying "Your old PIN was cleared, so here’s a new one…", with Skip for now (`pin-cleared`; the clear-PIN note in `set-staff-clear-pin`).

#### Scenario: Jo's PIN was cleared
- **WHEN** the Owner clears Jo Taylor's forgotten PIN and Jo opens Wheelhouse
- **THEN** "Your till PIN" opens with "Your old PIN was cleared, so here’s a new one"

### Requirement: The Owner makes a computer a till
The Owner, signed in, SHALL be able to make the computer they are on a till from "Set up this till" (`till-setup`): the shop as pills, the till number as pills with numbers used at that shop "In use", "Name (optional)", and "Make this computer Till [code]". The code SHALL be the shop's code and the number (B1). The computer SHALL stay that till when people sign in and out on it.

#### Scenario: Bolton's first till
- **WHEN** Jack Lewis, the Owner, chooses Bolton and B1 and presses "Make this computer Till B1"
- **THEN** the computer becomes Till B1, and the till shows "Till B1" and "Bolton · North Street Cycles"

#### Scenario: Numbers in use
- **WHEN** [Second site] already has [code]1 and [code]2
- **THEN** they show "In use" and [code]3 is chosen

### Requirement: Only the Owner sets up a till, once per computer
Nobody but the signed-in Owner SHALL set up a till, never by PIN alone (roles and switches 2). A computer that is already a till SHALL not be made another, and a number in use at that shop SHALL be refused.

#### Scenario: Already a till
- **WHEN** the Owner asks to make Till B1's computer another till
- **THEN** it is refused, and it stays Till B1

#### Scenario: Staff
- **WHEN** Jo Taylor asks the server to set up a till
- **THEN** it is refused

### Requirement: The till's browser key opens nothing on its own
The computer SHALL keep its till as a key of its own, apart from the offline till's, stored only hashed. It SHALL only say which till a signed-in browser is: copied out of the browser, it SHALL never open the till's offline copy or send sales, and the offline till's key SHALL never be kept by the browser. It SHALL be renewed whenever the till is used.

#### Scenario: Copied from the browser
- **WHEN** someone copies Till B1's key from the browser and asks for the till's offline copy with it
- **THEN** it is refused

### Requirement: The Owner can make a new computer an existing till
The Owner SHALL be able to make this computer an existing till, in place of the one that had it (a lost key or a replaced computer); the computer that had it SHALL stop being that till. No screen SHALL offer it until it is drawn.

#### Scenario: A replaced computer
- **WHEN** the Owner makes a new computer Till B1 again
- **THEN** the new computer is Till B1 and the old one is no till

### Requirement: Nobody else checked in sets up a till
When someone other than the Owner is checked in by PIN on a computer, a till SHALL not be set up on it, even under the Owner's sign-in.

#### Scenario: Jo is serving
- **WHEN** Jo Taylor is checked in on the computer and a till is asked for there
- **THEN** it is refused

### Requirement: The Owner makes a computer a workshop computer
The Owner, signed in, SHALL be able to make the computer they are on a workshop computer from Set up this computer: "A workshop computer", the shop as pills, "Name (optional)", and "Make this computer a workshop computer", with no till number. It SHALL stay a workshop computer when people sign in and out on it, kept as a key of the browser's own, stored only hashed.

#### Scenario: The workshop's computer
- **WHEN** Jack Lewis, the Owner, chooses "A workshop computer" and Bolton and presses "Make this computer a workshop computer"
- **THEN** the computer becomes a workshop computer at Bolton

### Requirement: Only the Owner sets up a workshop computer, once per computer
Nobody but the signed-in Owner SHALL set up a workshop computer, and not while someone else is checked in on it by PIN. A computer that is a till or a workshop computer SHALL not be made either again.

#### Scenario: Already a till
- **WHEN** the Owner asks to make Till B1's computer a workshop computer
- **THEN** it is refused, and it stays Till B1

#### Scenario: Staff
- **WHEN** Jo Taylor asks the server to set up a workshop computer
- **THEN** it is refused

### Requirement: A workshop computer asks for a PIN before anything
On a workshop computer with nobody working, every staff page SHALL show "Enter your PIN" under a bar reading "Workshop computer", the site and shop, and "Nobody working — enter your PIN", with no till number, no "Checked in today" and no "No PIN yet?" line. A PIN SHALL make that person the one working and open the page that was asked for; the front page SHALL open the diary.

#### Scenario: Alex starts work
- **WHEN** Alex Morgan types his PIN on the workshop computer
- **THEN** the diary opens with "Working: Alex Morgan · Switch" at the top

### Requirement: Every page on a workshop computer says who is working
While someone is working on a workshop computer, every page SHALL show "Working: [name] · Switch" at the top. Switch SHALL end their check-in and show Enter your PIN.

#### Scenario: Switch
- **WHEN** Alex Morgan presses Switch
- **THEN** Enter your PIN shows, and nobody is working

### Requirement: A workshop computer left alone goes back to Enter your PIN
A workshop computer SHALL go back to Enter your PIN after 10 minutes with nobody using it. The server SHALL stop counting the check-in 10 minutes after it was last used, whatever the screen does. A till SHALL stay checked in.

#### Scenario: A break
- **WHEN** Alex Morgan leaves the workshop computer for 10 minutes
- **THEN** it shows Enter your PIN, and nothing more is done as Alex until a PIN is typed

#### Scenario: Still working
- **WHEN** Alex Morgan keeps using the workshop computer
- **THEN** it stays his

### Requirement: Owner pages on a workshop computer only while the Owner is working
On a workshop computer, Owner-only pages and routes SHALL be refused unless the person checked in by PIN is the Owner, even when the computer is signed in as the Owner; anyone else working SHALL see what a staff sign-in sees. Tills and other browsers SHALL be unchanged.

#### Scenario: Alex is working
- **WHEN** the workshop computer is signed in as Jack Lewis, the Owner, and Alex Morgan is working
- **THEN** Settings says "Settings aren’t part of your role", and Owner-only changes are refused

#### Scenario: Jack Lewis is working
- **WHEN** Jack Lewis types his own PIN on the workshop computer
- **THEN** his Owner pages are there
