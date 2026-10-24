# Design: Customers, the list and Add a customer

## Decisions

1. **Recent** is the latest of a customer's own change, their newest job and
   their newest sale (`GET /api/recent-customers`, 25 of them, active only).
2. **The match** (`GET /api/customer-matches?phone=&email=`): the same phone
   digits (however spaced, at least 7) or the same email, active customers,
   five at most. The pop-up asks once typing pauses; "Use [name]" opens that
   customer's page. Names alone don't match: too many people share one, and
   the header search finds them.
3. **"A phone number or an email — at least one"** is checked in the pop-up.
   The server's add stays as it is for the booking page and the old app,
   which add customers their own ways.
4. **Address and postcode** are plain text (migration 067); a postcode is
   kept as typed, found by the header search ignoring spaces and case.
5. **Offers** are `marketing_permission` (migration 025), off unless ticked.
6. **The rows' bike** is the customer's newest bike; the phone shows on a
   computer, not a phone, as drawn.
