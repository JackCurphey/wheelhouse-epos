## ADDED Requirements

### Requirement: The customer can cancel a confirmed booking from its page
While a confirmed booking can still be cancelled online, its page SHALL offer "Cancel booking", which asks once ("Cancel this booking?") and then cancels it, showing "Your booking is cancelled" (Jack, 1 Oct, decision 10; 19 Oct).

#### Scenario: Cancelled
- **WHEN** Maya presses Cancel booking and confirms
- **THEN** her booking is cancelled and her page says "Your booking is cancelled" with "Book another time"

#### Scenario: Too late to cancel online
- **WHEN** her bike is already with the shop
- **THEN** the page doesn't offer Cancel booking
