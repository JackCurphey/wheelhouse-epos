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
A signed-in customer SHALL have an account page at their shop, "Your account", showing their name and email with Sign out, "Ask the shop a question" and "Book a repair", their bikes with any repair in now, their details and how the shop contacts them, and their history. "Ask the shop a question" SHALL open their conversation with the shop. Signed out, the page SHALL send the customer to sign in and back.

#### Scenario: Maya's account
- **WHEN** Maya, signed in, opens her account with her Trek in the shop
- **THEN** she sees "Your account" and her Trek with "In the shop now · WH-1042"

#### Scenario: someone new
- **WHEN** a customer with no bikes and no history opens their account
- **THEN** they see "No bikes yet. Add one to book it in faster." and "Nothing here yet. Your repairs and purchases with North Street Cycles show here."

#### Scenario: signed out
- **WHEN** someone not signed in opens the account
- **THEN** they are taken to sign in, and back to the account after

#### Scenario: asking the shop
- **WHEN** Maya chooses "Ask the shop a question"
- **THEN** her conversation, "Messages with North Street Cycles", opens

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

### Requirement: The account shows when each bike's next service is due

While a customer's service reminders are on, each of their bikes with a service reminder waiting SHALL show "Next service due [date]", the day the reminder is due to go, in the shop's own time zone. With reminders off, or no reminder waiting, no date SHALL show.

#### Scenario: a reminder waiting
- **WHEN** Maya's Trek has a service reminder waiting for Wed 17 Mar 2027, and her reminders are on
- **THEN** the bike shows "Next service due Wed 17 Mar 2027"

#### Scenario: reminders off
- **WHEN** Maya has switched service reminders off
- **THEN** no next service date shows

### Requirement: A signed-in customer changes how the shop contacts them

The account SHALL have "Change" beside "How we contact you", opening a box where job updates go by Text, WhatsApp or Email and Service reminders, Review requests and Offers and news switch on or off. Each change SHALL save at once and say what changed. Text or WhatsApp SHALL be refused with no mobile number on record. A change from another website SHALL be refused.

#### Scenario: switching off service reminders
- **WHEN** Maya switches Service reminders off
- **THEN** it saves at once, the box says "Service reminders are off", and her account shows Service reminders Off

#### Scenario: no mobile number
- **WHEN** a customer with no mobile number chooses Text
- **THEN** it is refused with "We don’t have a mobile number for you, so we can’t text you." and nothing changes

### Requirement: The stop page points to the account

Once something is stopped, the stop page SHALL say "Want to change anything else? Sign in to your account and go to “How we contact you”.", with "Sign in to your account" leading to the shop's sign-in, then the account.

#### Scenario: after stopping reminders
- **WHEN** Maya stops service reminders from a link
- **THEN** the page offers "Sign in to your account", which returns her to her account once signed in

### Requirement: A signed-in customer has one conversation with the shop
A signed-in customer SHALL have one running conversation with the shop, "Messages with [shop]", holding their messages, their notes on each of their repairs (each marked "About [job number]" and opening that repair) and the shop's replies, oldest first. They SHALL be able to send a message of up to 1,000 letters. Only the signed-in customer SHALL read or write their conversation, at their own shop, and a message sent from another website SHALL be refused (day answers 2.1, 2.3, 2.5 and 8.1).

#### Scenario: Maya asks a question
- **WHEN** Maya, signed in at North Street Cycles, sends a message from "Ask the shop a question"
- **THEN** it joins her conversation after her note about WH-1042, and the shop sees it needs a reply

#### Scenario: someone else
- **WHEN** another customer, or a session from another shop, asks for Maya's conversation
- **THEN** they get only their own, or are told they aren't signed in

#### Scenario: from another website
- **WHEN** a message is sent to Maya's conversation from another website
- **THEN** it is refused and nothing is added

### Requirement: The account's history has one row for the conversation
The account's history SHALL have one "Messages with [shop]" item when the customer has any message or note, dated by the newest message and saying whether the shop has replied (`ac-account-asked`). On the account page it SHALL show under Everything as one row, kind "Messages": "[date] · [shop] replied" with Replied under Earlier, or "[date] · waiting for a reply" with Sent under Now, opening the conversation.

#### Scenario: the shop has replied
- **WHEN** Jo has answered Maya's newest message
- **THEN** her history has "Messages with North Street Cycles", "North Street Cycles replied" and Replied, under Earlier, opening her conversation

### Requirement: A customer stays signed in for 30 days from their last visit
A customer's sign-in SHALL last 30 days from the last time they used it on that phone or computer, not 30 days from signing in (day answers 2.2). Renewing SHALL not write on every request: a session is renewed when used with less than 29 days left. A sign-in unused for 30 days SHALL end.

#### Scenario: a regular customer
- **WHEN** Maya signed in 10 days ago and opens her account
- **THEN** she stays signed in for 30 days from today

#### Scenario: away too long
- **WHEN** Maya hasn't used her sign-in for more than 30 days
- **THEN** she is asked to sign in again

### Requirement: The conversation page
A signed-in customer SHALL have a page "Messages with [shop]" at `/book/[shop]/messages`, with "Your account" back and their conversation oldest first: their own on the right, the shop's on the left, each repair note marked "About WH-[n]" and opening that repair. Signed out, it SHALL go to sign in and back (`ac-ask`, `ac-account-question-sent`, `ac-question`; day answers 2 and 8.1).

#### Scenario: signed out
- **WHEN** Maya opens her messages without being signed in
- **THEN** she goes to sign in, and comes back to her messages after

#### Scenario: a note on a repair
- **WHEN** Maya's conversation has her note on WH-1042
- **THEN** it is marked "About WH-1042 ›", which opens that repair

#### Scenario: too many at once
- **WHEN** the shop refuses a message because too many were sent at once
- **THEN** the page shows the shop's words: "That’s a lot of messages at once. Try again in a few minutes."

### Requirement: Sending a message
The conversation page SHALL have a box with Send and "We'll let you know when [shop] replies." The box SHALL read "Ask the shop a question" while there are no messages and "Your message" after. After sending, the page SHALL say "Sent. We'll let you know when [shop] replies."

#### Scenario: Maya asks a question
- **WHEN** Maya writes in "Ask the shop a question" and sends it
- **THEN** her message joins the thread on the right, and "Sent. We'll let you know when North Street Cycles replies." is announced

### Requirement: A customer's request is looked up once
The server SHALL look up a customer's sign-in once per request to the shop's website, before it takes that request's database connection, and only when the request carries a sign-in cookie. Every later "who is signed in?" check in the same request SHALL use that answer without taking a second connection. A customer signed in to one shop SHALL still get nothing from another shop.

#### Scenario: many customers check their account at once
- **WHEN** 12 requests for a customer's own account arrive at the same moment, whether signed in or carrying a cookie that matches no sign-in
- **THEN** every one is answered (signed in, or "Not signed in") well within the 5-second wait for a connection

#### Scenario: a customer of one shop asks another
- **WHEN** a customer signed in to North Street Cycles asks Elsewhere Cycles for their account, bikes, bookings, history or a repair by `job-<id>`
- **THEN** they are refused as not signed in (or "We can't find that booking"), as before

#### Scenario: a public page when the sign-in can't be checked
- **WHEN** a page that needs no sign-in, such as the shop's services or terms, is opened with a cookie that can't be looked up
- **THEN** the page still answers as normal

### Requirement: The shop's website never stops the server
When the server can't find the shop a website request names (the database is too busy to answer in time, or the shop's name in the address is one it can't look up), or a website request fails for any other reason, it SHALL answer that request with "Internal server error", never the database's own words, and SHALL go on answering every other request, for every shop. An address it can't read at all SHALL get "Bad request".

#### Scenario: a shop name the database refuses
- **WHEN** a request to the shop's website names a shop the database can't look up
- **THEN** that request gets "Internal server error", saying nothing about the database
- **AND** the next request, from anyone, is answered as normal

#### Scenario: an address that can't be read
- **WHEN** a request arrives for an address with a broken escape, such as `/%ZZ`
- **THEN** it gets "Bad request", and the next request is answered as normal

### Requirement: Many customers can sign in by code at once
Signing a customer in by an emailed code SHALL make the customer's sign-in on the request's own database connection, so that many customers signing in at the same moment are all answered.

#### Scenario: 12 customers enter their codes at the same moment
- **WHEN** 12 customers of North Street Cycles each enter their correct emailed code at the same moment
- **THEN** every one is signed in well within the 5-second wait for a connection, and each sign-in opens that customer's own account

### Requirement: A customer downloads a copy of their data
A signed-in customer SHALL be able to download, straight away, one zip file of what the shop holds about them: their details, bikes, repairs, purchases, messages and what they agreed to, each as a spreadsheet (CSV). It SHALL hold only their own data, never another customer's or another shop's. A request that isn't signed in to that shop, or comes from another website, SHALL be refused.

#### Scenario: Maya downloads her data
- **WHEN** Maya Patel, signed in to North Street Cycles, presses "Download a copy of your data"
- **THEN** a zip downloads with her details, her Trek Domane AL 3, her repairs, her purchases, her messages with the shop and her answers on how she's contacted

#### Scenario: Someone else's data
- **WHEN** another customer of the same shop downloads their copy
- **THEN** nothing of Maya's is in it

#### Scenario: Too many at once
- **WHEN** Maya asks for another copy later the same day
- **THEN** it is refused, as "One copy a day" says

#### Scenario: Not signed in
- **WHEN** the download is asked for without signing in, or signed in to another shop
- **THEN** it is refused and nothing is logged

### Requirement: Each copy is logged
Each copy downloaded from the account SHALL be recorded as a privacy request from the account, with the sign-in that asked, asked and done at the same moment, before the file is sent. A merge of two customers SHALL move the record with the customer, and its Undo SHALL move it back, along with any copy asked for since by the sign-in that goes back.

#### Scenario: The log
- **WHEN** Maya downloads her copy
- **THEN** a privacy request for a copy of her data, from her account, asked and done now, is recorded for North Street Cycles

### Requirement: The Your data card
The account SHALL show a "Your data" card under History (last on a phone) with "Download a copy of your data". Once the download starts, the account SHALL say "Your data is downloading as one file, [file name] — details, bikes, jobs, purchases, messages and what you agreed to." with "Not started? Download it again". If it fails, it SHALL say "The download didn’t start." with Try again.

#### Scenario: It downloads
- **WHEN** Maya presses "Download a copy of your data"
- **THEN** the green bar names the file and offers "Not started? Download it again"

#### Scenario: It fails
- **WHEN** the download can't be made
- **THEN** "The download didn’t start." shows with Try again

### Requirement: One copy a day
Each sign-in SHALL be able to download one copy of its data a day, the shop's day from midnight in its time zone, counted from the privacy requests log. A second that day SHALL be refused with "You’ve already downloaded a copy today. You can get another tomorrow." before anything is logged; two at the same moment SHALL let only one through. The account SHALL show the refusal in those words with no Try again, and "Not started? Download it again" SHALL save the same file without asking the shop.

#### Scenario: A second copy the same day
- **WHEN** Maya asks for another copy later the same day
- **THEN** it is refused with "You’ve already downloaded a copy today. You can get another tomorrow.", nothing is logged, and the account shows those words with no Try again

#### Scenario: The next day
- **WHEN** Maya asks again just after midnight in the shop's time zone
- **THEN** she gets a copy

#### Scenario: Two at once
- **WHEN** two requests from Maya's sign-in arrive at the same moment
- **THEN** one gets the copy and one is refused, and one copy is logged

#### Scenario: Download it again
- **WHEN** Maya presses "Not started? Download it again"
- **THEN** the same file saves again and the shop isn't asked, so it doesn't use up her day

### Requirement: A customer asks the shop to delete their account
A signed-in customer SHALL be able to ask the shop to delete their account from Your data, after a pop-up saying what goes and what stays. The request SHALL be recorded once, from their account, and show on the account with when they asked and when it will be done by (one month on), with "Cancel my request". A bike still in the workshop SHALL NOT stop them asking; the pop-up SHALL say the deletion waits until it has been collected.

#### Scenario: Maya asks
- **WHEN** Maya Patel presses "Ask us to delete your account" and then "Ask to delete"
- **THEN** "Request sent" says North Street Cycles will delete her account by [date] at the latest, and her account shows "You asked us to delete your account on [date]. We’ll finish by [date]." with "Cancel my request"

#### Scenario: Her bike is still in the workshop
- **WHEN** her Trek Domane AL 3 is in the workshop as WH-1042 and she asks
- **THEN** the pop-up says "We’ll delete your account once your bike has been collected." and she can still ask

#### Scenario: Asking twice
- **WHEN** she asks again, or two asks arrive at once
- **THEN** there is still one request

### Requirement: Cancel my request
While the shop hasn't yet deleted their details, the customer SHALL be able to cancel their request from the account, which then says "Request cancelled — your account stays as it is." Once the shop has deleted their details, there is no account left to cancel from.

#### Scenario: Maya changes her mind
- **WHEN** Maya presses "Cancel my request"
- **THEN** the request is cancelled, leaves the shop's list, and her account says "Request cancelled — your account stays as it is."
