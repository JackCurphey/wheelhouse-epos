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
When the shop has suggested another time, the customer's booking page SHALL say what the shop can't do, the time it suggests and its message, with "Accept this time" and "Cancel my request" (Jack, 1 Oct, decision 12; 20 Oct).

#### Scenario: Accepting the offer
- **WHEN** Sam presses Accept this time
- **THEN** the booking is confirmed for the suggested time

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
