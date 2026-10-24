# book Specification

## Purpose
The customer's side of booking a repair online: the booking page their private link opens, and what it tells them about their booking.

## Requirements

### Requirement: The booking page says when to drop the bike off
Once a booking is confirmed, the customer's booking page SHALL say when to drop the bike off (Jack, 19 Oct): with a set time, before the booking by the shop's lead time ("Drop your Trek Domane AL 3 off by 11:00, half an hour before your booking at 11:30."); for the whole day, in the shop's drop-off window ("Drop your bike off between 09:00 and 10:00.").

#### Scenario: A set time
- **WHEN** Maya's confirmed booking is at 11:30 and the shop's lead time is 30 minutes
- **THEN** her booking page says "Drop your Trek Domane AL 3 off by 11:00, half an hour before your booking at 11:30."

#### Scenario: Not confirmed yet
- **WHEN** the booking is still waiting for the shop to accept it
- **THEN** the page doesn't tell her when to drop off

### Requirement: Notice can be in whole days
When a shop sets its notice in days, customers SHALL be able to book from the start of the day that many days ahead, whatever the time now (Jack, 19 Oct). Notice in hours SHALL stay counted from now.

#### Scenario: 3pm, one day's notice
- **WHEN** it's 15:00 and the shop's notice is 1 day
- **THEN** a customer can book any time tomorrow, from opening

#### Scenario: 3pm, 24 hours' notice
- **WHEN** it's 15:00 and the shop's notice is 24 hours
- **THEN** the earliest a customer can book is 15:00 tomorrow

### Requirement: The booking page shows the shop's additional note
Once a booking stands (confirmed, or a change to it waiting), the customer's booking page SHALL show the shop's additional note after the drop-off sentence (Jack, 19 Oct): "Drop your Trek Domane AL 3 off by 11:00, half an hour before your booking at 11:30. Please bring the lock key, and tell us about any accessories."

#### Scenario: A confirmed booking
- **WHEN** Maya's booking is confirmed and the shop's note is "Please bring the lock key, and tell us about any accessories."
- **THEN** her booking page shows the note after when to drop the bike off

#### Scenario: Not confirmed yet
- **WHEN** the booking is still waiting for the shop to accept it
- **THEN** the page doesn't show the note

#### Scenario: No note
- **WHEN** the shop has emptied its note
- **THEN** the booking page shows only when to drop the bike off

### Requirement: The confirmed booking page follows its drawing
A confirmed booking's page SHALL show "Your repair · [reference]" above a heading naming the bike and the work, then a card with the "Booking confirmed" badge, when to drop the bike off and the shop's note, the Service, Bike, When and Your repair rows, and the shop's name (drawn as bk-page; Jack, 19 Oct).

#### Scenario: Maya's confirmed booking
- **WHEN** Maya's Standard service on her Trek Domane AL 3 is confirmed
- **THEN** her page is headed "Trek Domane AL 3 · Standard service", under "Your repair · WH-1042", with the badge "Booking confirmed"

#### Scenario: Another stage
- **WHEN** the booking is still waiting for the shop
- **THEN** the page is headed "Awaiting shop confirmation", as before

### Requirement: The customer can cancel a confirmed booking from its page
While a confirmed booking can still be cancelled online, its page SHALL offer "Cancel booking", which asks once ("Cancel this booking?") and then cancels it, showing "Your booking is cancelled" (Jack, 1 Oct, decision 10; 19 Oct).

#### Scenario: Cancelled
- **WHEN** Maya presses Cancel booking and confirms
- **THEN** her booking is cancelled and her page says "Your booking is cancelled" with "Book another time"

#### Scenario: Too late to cancel online
- **WHEN** her bike is already with the shop
- **THEN** the page doesn't offer Cancel booking

### Requirement: The customer can ask for a new date from the booking page
While a confirmed booking can still be changed online, its page SHALL offer "Change the date", showing the days and times its mechanic could take it, its own slot included; asking for a new date SHALL leave the booking as it is until the shop confirms (Jack, 1 Oct, decision 10; 19 and 20 Oct).

#### Scenario: Asking for Friday
- **WHEN** Maya picks Friday 25 September at 14:00 and presses Ask for this date
- **THEN** her page says "New date waiting for the shop" and her booking stays on Thursday until the shop confirms

#### Scenario: Taking it back
- **WHEN** she presses Cancel my date change
- **THEN** her booking is confirmed for Thursday, as before

#### Scenario: The shop can't do it
- **WHEN** the shop declines the new date
- **THEN** her page says the shop couldn't do the new date, and her booking is still Thursday

### Requirement: A booking waiting for the shop opens as a request
A booking the shop hasn't accepted SHALL show "Your booking request" with the "Waiting for the shop to confirm" badge, its rows, and Change the date and Cancel request while it can be changed or cancelled online (Jack, 1 Oct, decisions 10 and 12; 20 Oct).

#### Scenario: Moving a request
- **WHEN** Maya moves her request to Friday at 14:00
- **THEN** it moves straight away, still waiting for the shop to confirm

#### Scenario: Cancelling a request
- **WHEN** she presses Cancel request and confirms
- **THEN** her page says it is cancelled

### Requirement: The customer answers an offered time on the booking page
When the shop has suggested another time, the customer's booking page SHALL say what the shop can't do, the time it suggests and its message, with "Accept this time" and "Cancel my request" (Jack, 1 Oct, decision 12; 20 Oct). Accepting SHALL confirm only the time the page showed: if the shop has changed it since, the page SHALL say "The shop has changed the time it’s offering. Here’s the new one." and show the new time (Jack, 22 Oct).

#### Scenario: Accepting the offer
- **WHEN** Sam presses Accept this time
- **THEN** the booking is confirmed for the suggested time

#### Scenario: The shop changed the time meanwhile
- **WHEN** Sam's page shows Friday at 12:00, the shop offers Monday at 09:00 instead, and Sam presses Accept this time
- **THEN** nothing is confirmed, and the page says the shop has changed the time and shows Monday at 09:00

### Requirement: A declined booking's page says so, with the shop's message
A declined booking's page SHALL say "Sorry, we can't fit this booking in", show the shop's message, say nothing is booked, and offer to choose another date (Book a repair 12; Jack, 20 Oct).

#### Scenario: Sam's declined request
- **WHEN** the shop declines Sam's request with a message
- **THEN** Sam's page shows the message under "A message from North Street Cycles:"

### Requirement: The booking page shows the bike's later stages to their drawings
Once the bike is in the shop, ready or collected, the booking page SHALL show "Your repair · [reference]" above a heading for that stage, the booking's rows and the shop. On the ready and collected pages it SHALL also show the tracker with Ready current, and on the ready page "To pay when you collect". None of these pages SHALL offer Copy link or the contact line.

#### Scenario: A bike in the workshop
- **WHEN** the customer opens the link while the bike is in the shop
- **THEN** the heading reads "Your bike is in the workshop", with no tracker and no contact line

#### Scenario: A bike ready to collect
- **WHEN** the work is finished
- **THEN** the heading reads "Your [bike] is ready", the tracker's steps are all ticked with Ready current, and the page says to pay at the counter by card or cash

#### Scenario: A collected bike
- **WHEN** the bike has been collected
- **THEN** the heading reads "Your [bike] has been collected" and a Collected card says the page keeps working for 30 days after collection

### Requirement: An expired request's page says so and offers another date
A booking request the shop never answered SHALL, once expired, say "Sorry, we couldn't get back to you in time", that the shop couldn't answer the request for its day and time in time, and that nothing is booked, with "Choose another date".

#### Scenario: The shop didn't answer in time
- **WHEN** the customer opens the link of an expired request
- **THEN** the page says it has expired and nothing is booked, and "Choose another date" opens the shop's booking start

### Requirement: The booking link says how far the bike is, and who to contact
The booking link SHALL carry:
- how far the work is;
- when the bike was booked in and collected;
- the day the bike is expected to be ready (the job's last day);
- the shop's address, phone and opening hours.

#### Scenario: A bike in the workshop
- **WHEN** the customer opens the link after their bike is booked in and started
- **THEN** it says the work is in progress and when the bike was booked in, with the shop's address, phone and hours

### Requirement: A booking link lasts 30 days after collection
A booking link SHALL stop working 30 days after its bike was collected. A link SHALL keep working while its bike is in the shop. A link whose bike never came in SHALL stop working 30 days after its booked day. An expired link SHALL say which job it was, why it expired, and the shop's name, address and phone, with nothing that identifies the customer.

#### Scenario: Collected 31 days ago
- **WHEN** the customer opens the link of a bike collected 31 days ago
- **THEN** it is refused as expired, giving the job's number, "collected", and the shop's details

#### Scenario: Still in the shop
- **WHEN** a bike booked 40 days ago is still in the shop
- **THEN** its link still works

### Requirement: A booking is confirmed straight away when the shop confirms automatically
When the shop confirms online bookings automatically, a booking that fits the diary SHALL be confirmed when sent: step 4's button reads "Confirm booking", and the customer's booking page shows it confirmed at once (Jack, 1 Oct, decision 8; 19 Oct).

#### Scenario: Confirmed at once
- **WHEN** the shop confirms automatically and Maya books a time that fits
- **THEN** her booking page shows "Confirmed", with when to drop the bike off

#### Scenario: The shop answers each request
- **WHEN** the shop doesn't confirm automatically
- **THEN** step 4's button reads "Request booking" and the booking waits for the shop to accept it

### Requirement: The booking page shows the work and the money, figures only when prices show
Once the bike is in, the booking page SHALL list the work on the job. Once ready, it SHALL list what the customer declined, what's left to pay, or what was paid and when. With "Show prices on the booking page" off, every figure SHALL be hidden and the rest SHALL still show (Jack, 21 Oct, answer 4).

#### Scenario: Ready, prices shown
- **WHEN** Maya opens her link once her bike is ready
- **THEN** the page shows "To pay when you collect £111.00", then What we did with each line's price, and "Not done — you said no thanks: Replace gear cable (£12.00)"

#### Scenario: Prices hidden
- **WHEN** the shop doesn't show prices online
- **THEN** the same lines show with no figures

### Requirement: An expired link's page says which job and gives the shop
An expired link's page SHALL give the job's number and the shop's address and phone. A collected job's page SHALL say it has been collected. A booking whose bike never came in SHALL give the 30-day rule and "Book a repair".

#### Scenario: Collected long ago
- **WHEN** Maya opens her link 31 days after collecting her bike
- **THEN** it says "This link has expired" and that the job was collected, with the shop's details

### Requirement: The customer's quote names staff only when the shop shows who signed off
The quote on the customer's booking link SHALL follow its drawings (journey 4). It SHALL name the mechanic, and who took an answer by phone or in the shop, only when the shop's "Show who signed off to customers" switch is on; otherwise it SHALL say "we" (Jack, 22 Oct). It SHALL thank the customer by first name, and offer the shop's phone for anyone not sure.

#### Scenario: Switch on
- **WHEN** Alex Morgan's quote is sent to Maya Patel and the shop's switch is on
- **THEN** the card says "Alex recommends more work", and once Maya answers, "Thanks, Maya — Alex is carrying on"

#### Scenario: Switch off
- **WHEN** the same quote is sent with the switch off
- **THEN** the card says "We recommend more work", and once Maya answers, "Thanks, Maya — we’re carrying on", and the reply carries no staff names

#### Scenario: Answered by phone
- **WHEN** Jo Taylor records Maya's answer by phone and the switch is off
- **THEN** Maya's page says "Your answers, from your call" and "You answered by phone at [time]. Here’s what was agreed.", without Jo's name

#### Scenario: Withdrawn
- **WHEN** the shop withdraws the quote with the switch off
- **THEN** the card says "We’ve withdrawn this quote" and "Nothing to answer. Call [shop phone] if you have a question."

### Requirement: The finished job's checklist shows on the booking page
Once the work is finished, the ready and collected booking pages SHALL show the job's checklist, if a mechanic ticked or noted anything on it, as it was then, after "What we did": each check done, reading "All working well" or "What the mechanic found:" with its note, then "[n] of [n] checks done." and the checks not done by name (cp-summary; Workshop day 21; audit M1, Jack 30 Sep). It SHALL NOT show while the work is under way.

#### Scenario: Eight of ten done, one note
- **WHEN** the mechanic ticked eight checks, noting the brakes, and finished the work
- **THEN** the page lists the eight, the brakes with what the mechanic found, and reads "8 of 10 checks done. Not done: Cables & housing, Bolts torqued."

#### Scenario: A checklist nobody used
- **WHEN** the work was finished without anything ticked or noted on the job's checklist
- **THEN** the page shows no checklist, rather than "0 of 10 checks done"

### Requirement: Quote lines that go together are answered together
On the customer's quote, a labour line that goes with a part SHALL tick and untick with it (Jack, 1 Oct, decision 2), and the server SHALL refuse an answer that says yes to one and no to the other. An unticked Needed line SHALL show the mechanic's words on what happens without it, when the shop wrote some (decision 7).

#### Scenario: Unticking the part
- **WHEN** Maya unticks Shimano brake pads, which Fit and adjust brakes goes with
- **THEN** Fit and adjust brakes is unticked too, the total drops by both, and a screen reader hears "Fit and adjust brakes unticked too."

#### Scenario: What happens without it
- **WHEN** Maya unticks Shimano brake pads, whose without words are "The rear brake stays worn."
- **THEN** the card shows "We recommend this. The rear brake stays worn." under it

#### Scenario: A split answer
- **WHEN** an answer says yes to the pads and no to the fitting
- **THEN** it is refused and nothing is saved

### Requirement: The customer sees a quote line's photo and can enlarge it
A quote line with a photo SHALL show a small picture beside its reason on the customer's quote, with "Tap to enlarge"; tapping it SHALL open the photo larger, titled with the line and its reason (Jack, 1 Oct). The photo SHALL be served only through the booking's link, and only for a line of its current quote.

#### Scenario: Enlarging the pads photo
- **WHEN** Maya taps the photo beside Shimano brake pads
- **THEN** a pop-up titled "Shimano brake pads" shows the reason and the photo larger, with Close

#### Scenario: A photo not on the current quote
- **WHEN** a link asks for the photo of a line on an older revision, or of another booking's line
- **THEN** nothing is served (not found)

### Requirement: A newer quote keeps the customer's earlier answers as history
When the shop sends a quote after the customer has answered an earlier one, the customer's quote SHALL say "The quote has changed", that the earlier answers are kept, what was already agreed and what they said no thanks to, and ask only about the new lines (Jack, 22 Oct; dq-quote-newer).

#### Scenario: Pads after all
- **WHEN** Maya said no to the pads and the cable, then rings back, and the shop sends a new quote with just the pads
- **THEN** her page says "The quote has changed", "You said no thanks: Shimano brake pads, Replace gear cable", and asks only about the pads

### Requirement: The customer can set a spending limit when booking
The booking's bike step SHALL ask "If the mechanic finds more to do", with "Ask me before any extra work" chosen to start and "Go ahead if the whole bill comes to no more than £[amount]", the amount in whole pounds (Workshop day 41). A limit SHALL be stored on the job; asking first stores none.

#### Scenario: Setting £200
- **WHEN** Maya chooses Go ahead and leaves £200, then books
- **THEN** her job's limit is £200, and her summary says "Extra work: go ahead if the whole bill is no more than £200"

#### Scenario: Not a whole amount
- **WHEN** Maya chooses Go ahead and enters "150.50"
- **THEN** Continue is refused with "Enter the most the whole bill can come to, in whole pounds."

### Requirement: The customer's quote says when a reminder was sent
Once the reminder has gone, the customer's quote SHALL say so beside when it was sent: "Sent Thu 17 Sep, 10:15 · we sent a reminder at 10:15" (dq-quote-reminded).

#### Scenario: After the reminder
- **WHEN** Maya opens her quote after the reminder went at 10:15
- **THEN** the sent line ends "· we sent a reminder at 10:15"

### Requirement: The customer can write to the shop from their booking page
Through their booking link, the customer SHALL be able to add a note for the shop and read the shop's replies, oldest first, with staff names only when the shop shows who signed off (decision 3).

#### Scenario: A note
- **WHEN** Maya adds "Can you check the back light too?" on her booking page
- **THEN** it is saved on her job, and her page lists it as hers

### Requirement: The booking page shows the conversation with the shop
From the bike being in the shop until the page closes after collection, the customer's booking page SHALL show "Notes with the shop": the notes so far, a box to add a note (then to reply), and that the shop will reply there and let them know (ac-job-note).

#### Scenario: Waiting for a reply
- **WHEN** Maya sends "Can you check the back light too?"
- **THEN** her page shows it as hers and "Sent. North Street Cycles will reply here, and we’ll let you know when they do."

### Requirement: The quote and the agreed work lead to a note for the shop
While the bike is in the shop, the customer's quote card SHALL end "Not sure? Call [shop phone], or" with an "Add a note for the shop" button, and the Work agreed card SHALL end with the same button (dq-quote, dq-in-shop). The button SHALL move the customer to the Notes with the shop card and put the cursor in its box. Where the page has no notes card, the quote card SHALL offer the phone only.

#### Scenario: Not sure about the quote
- **WHEN** Maya, looking at her quote, taps "Add a note for the shop"
- **THEN** the page moves to Notes with the shop and the cursor is in its box, ready to type

#### Scenario: Before the bike is in
- **WHEN** the page has no Notes with the shop card
- **THEN** the quote card says "Not sure? Call [shop phone]." with no note button

### Requirement: On a tablet or phone the quote's answer stays pinned at the bottom

While a quote waits for the customer's answer on a tablet or phone, the booking page SHALL keep a bar pinned along the bottom holding the new total, "Your answers are final once sent." and the one send button, and the quote itself SHALL NOT repeat that line or button. On a computer they SHALL stay in the quote. Sending SHALL stay one click with no confirming pop-up.

#### Scenario: Maya opens her quote on her phone

- **WHEN** Maya opens her booking page on her phone and the quote for Shimano brake pads, Fit & adjust brakes and Replace gear cable waits for her answer
- **THEN** a bar along the bottom shows "New total £111.00", "Your answers are final once sent." and "Approve £111.00", and stays in view as she scrolls

#### Scenario: Unticking lines changes the bar

- **WHEN** Maya unticks Shimano brake pads, and Fit & adjust brakes goes with it
- **THEN** the bar's total becomes £65.00 and its button reads "Decline the extra work"

#### Scenario: One tap sends

- **WHEN** Maya taps the bar's button
- **THEN** her answers are sent at once, with no "Send your answers?" pop-up

#### Scenario: On a computer the button stays in the quote

- **WHEN** Maya opens the same quote on a computer
- **THEN** "Your answers are final once sent." and the button sit inside the quote, and no bar is pinned

#### Scenario: The bar covers nothing

- **WHEN** Maya scrolls to the bottom of her booking page on a 320-pixel-wide phone
- **THEN** the last thing on the page sits above the bar, not under it

#### Scenario: No bar once answered

- **WHEN** the quote has been answered or withdrawn
- **THEN** no bar is pinned

### Requirement: A booking request's photos are saved without where they were taken

Before a customer's booking photos are saved, the server SHALL remove their hidden details: location, time taken, camera and phone details, and embedded text. It SHALL keep which way up the photo goes and its colour profile, and SHALL NOT change the picture itself.

#### Scenario: A photo taken at home

- **WHEN** Maya adds a photo of her Trek Domane AL 3 taken on her phone at home to her booking request
- **THEN** the saved photo carries no location, no time taken and no phone details

#### Scenario: A phone photo stays the right way up

- **WHEN** the photo was taken with the phone held upright
- **THEN** the saved photo still shows upright

#### Scenario: The picture is unchanged

- **WHEN** a photo has its hidden details removed
- **THEN** the picture itself is exactly the same as the one Maya sent

### Requirement: A booking takes the shop's deposit, held first and taken once the booking is saved

When the shop takes a deposit, a booking request SHALL need the deposit held
on a card first, worked out by the server from the stored prices, never
taken from the booking page. The booking SHALL be saved with the deposit and
when it is free to cancel until, and only then SHALL the money be taken; a
booking that can't be saved SHALL let the hold go. Sending the same request
again SHALL book once and take once.

#### Scenario: Paid and booked
- **WHEN** the shop takes 20% and a customer holds £13.00 on a £65.00 service and sends the booking
- **THEN** the booking is saved with a £13.00 deposit, the £13.00 is taken, and it is free to cancel until 24 hours before

#### Scenario: Not held
- **WHEN** the shop takes a deposit and a booking request comes without a held deposit
- **THEN** it is refused, saying the deposit is needed, and nothing is booked

#### Scenario: The slot went
- **WHEN** the deposit is held and the time is gone by the time the booking is sent
- **THEN** nothing is booked and the hold is let go, so nothing is taken

#### Scenario: Sent twice
- **WHEN** the connection drops after paying and the customer sends again
- **THEN** the booking already made is answered, and the deposit is taken once

#### Scenario: Declined card
- **WHEN** the card is declined
- **THEN** nothing is held, and the booking can't be sent until a card is accepted

### Requirement: The customer pays the deposit on step 4 before the booking is sent

When the shop takes a deposit, step 4 SHALL show the deposit part drawn in
`bk-details-deposit` with the amount, the refund and cancel lines and the card
form, the summary SHALL show "Deposit to pay now", and the button SHALL read
"Pay £[deposit] and send request", or "Pay £[deposit] and book" when the shop
confirms automatically. Pressing it SHALL pay, then send the booking.

#### Scenario: Paid and sent
- **WHEN** the shop takes 20% of a £65.00 service and the customer enters an accepted card and presses Pay £13.00 and send request
- **THEN** the deposit is held, the booking is sent with it, and the customer is taken to their booking

#### Scenario: A declined card
- **WHEN** the card is declined
- **THEN** "The card didn't go through. Nothing was taken and nothing is booked yet. Try again, or use another card." shows, the button reads Try again, and nothing is sent

#### Scenario: The connection drops after paying
- **WHEN** the card was accepted and the booking couldn't be sent
- **THEN** "We're checking whether your payment went through — please don't pay again." shows with Check again, which sends the same booking without paying again

#### Scenario: No deposit
- **WHEN** the shop takes no deposit
- **THEN** step 4 has no deposit part and its button is as before

### Requirement: The booking page shows the deposit paid and when it's free to cancel until

A booking that took a deposit SHALL show "Deposit paid" with the amount and
"Free to cancel until" with the day and time in the shop's time, above "Your
repair", as drawn in `bookingLines`. A request waiting for the shop SHALL add
"If we can't fit you in, your deposit comes back in full." A booking with no
deposit SHALL show neither.

#### Scenario: A confirmed booking with a deposit
- **WHEN** Maya's booking took £13.00 and is free to cancel until 24 hours before Monday 11:30
- **THEN** her page shows Deposit paid £13.00 and Free to cancel until Sunday 4 October, 11:30

#### Scenario: A request with a deposit
- **WHEN** her request is waiting for the shop
- **THEN** the page adds "If we can't fit you in, your deposit comes back in full."
