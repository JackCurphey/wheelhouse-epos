# customer-accounts Specification

## Purpose
How a shop's customers sign in to their account on the shop's own website: by a code sent by email (signing-in decision 5).

## Requirements

### Requirement: Customers sign in with a code sent by email
A customer SHALL be able to sign in to a shop with a six-digit code emailed to them, valid for 10 minutes and used once. A wrong code SHALL say so; an expired one SHALL say "That code has expired — send a new one". Asking for a code SHALL answer the same whether the email has an account or not. Asking and checking SHALL be limited per network and per email.

#### Scenario: Maya signs in
- **WHEN** Maya asks for a code at North Street Cycles and types the one emailed to her
- **THEN** she is signed in to North Street Cycles

#### Scenario: an old code
- **WHEN** a code more than 10 minutes old is typed
- **THEN** sign-in is refused with "That code has expired — send a new one"

#### Scenario: not switched on
- **WHEN** no sign-in provider is connected
- **THEN** asking for a code says "Signing in by email isn’t switched on yet"

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

### Requirement: A first code sign-in joins the one customer the shop already has
The first sign-in by code with an email SHALL join the customer the shop already has with that email, ignoring case and spaces, when there is exactly one such active customer, that customer has no online account, and the email is one the customer gave themselves (at an online booking or sign-up, and not changed by staff since). Otherwise it SHALL make a new customer and login. Sign-up with a password SHALL never join an existing customer.

#### Scenario: Maya booked as a guest
- **WHEN** Maya, who booked a repair as a guest with maya@example.test, signs in with a code sent to that email for the first time
- **THEN** she is signed in as the customer who booked that repair

#### Scenario: an email staff typed in
- **WHEN** staff saved a customer with an email, and someone signs in with a code sent to that email
- **THEN** a new customer is made, for staff to join with Merge

#### Scenario: two customers share the email
- **WHEN** two of the shop's customers have the email and someone signs in with a code sent to it
- **THEN** a new customer is made, for staff to join with Merge

### Requirement: Signed-in customers open their own repairs
A signed-in customer SHALL be able to open the page of any repair of theirs at that shop from their account, with everything the private link's page offers, after the link's 30 days too. Opening a repair that isn't theirs, or without signing in, SHALL answer as an unknown link does.

#### Scenario: another customer's repair
- **WHEN** a signed-in customer asks for a repair that belongs to someone else
- **THEN** they are told it can't be found

### Requirement: Signed-in customers see their history
A signed-in customer SHALL be able to see their repairs, each with its stage and total, and their purchases, with what was bought and the total, newest first.

#### Scenario: a repair and a till sale
- **WHEN** Maya has a repair in the shop and bought something at the till
- **THEN** her history lists both, newest first

### Requirement: The account page
A signed-in customer SHALL have an account page at their shop, "Your account", showing their name and email with Sign out, their bikes with any repair in now, their details and how the shop contacts them, and their history. Signed out, the page SHALL send the customer to sign in and back.

#### Scenario: Maya's account
- **WHEN** Maya, signed in, opens her account with her Trek in the shop
- **THEN** she sees "Your account" and her Trek with "In the shop now · WH-1042"

#### Scenario: someone new
- **WHEN** a customer with no bikes and no history opens their account
- **THEN** they see "No bikes yet. Add one to book it in faster." and "Nothing here yet. Your repairs and purchases with North Street Cycles show here."

#### Scenario: signed out
- **WHEN** someone not signed in opens the account
- **THEN** they are taken to sign in, and back to the account after

### Requirement: The account's history
The account's history SHALL list the customer's repairs and purchases, filtered by Everything, Repairs or Purchases, with what's open now first and the rest newest first, eight at a time. A repair SHALL open its own page.

#### Scenario: a repair in the shop
- **WHEN** Maya's repair is in the shop
- **THEN** it is under Now, and choosing it opens its page

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
