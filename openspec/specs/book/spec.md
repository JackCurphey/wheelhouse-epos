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
